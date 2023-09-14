import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime, LayerVersion, Code, Architecture, Function, FunctionProps, Version, Alias } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';
import { RestApi, IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, SpecRestApi, ApiDefinition, Deployment, StageProps, Stage, EndpointType } from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Config } from '@edfi/meadowlark-utilities';
import { isObject, transform, uniqueId } from 'lodash';
import { Vpc, GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService, SecurityGroup, SubnetType, Peer, Port, Subnet } from 'aws-cdk-lib/aws-ec2';
import { env } from 'process';
import { Duration } from 'aws-cdk-lib';
import { PredefinedMetric, ScalableTarget, ServiceNamespace } from 'aws-cdk-lib/aws-applicationautoscaling';
import { AutoscaleProvisionedConcurrentLambda, MetricType } from './construct/autoscale-provisioned-concurrent-lambda'

const LAMBDAS = join(__dirname, '..', 'lambda');

interface MeadowlarkStackProps extends cdk.StackProps {
  resourcesSwaggerDefinition: string;
  descriptorsSwaggerDefinition: string;
  dotenvVars: NodeJS.ProcessEnv;
}

export class MeadowlarkLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MeadowlarkStackProps) {
    super(scope, id, props);
    const vpc = Vpc.fromLookup(this, 'VPC', { vpcName: props.dotenvVars['AWS_VPC_NAME'] });
    const subnetAz1 = Subnet.fromSubnetId(this, 'subnet_az1', props.dotenvVars["AWS_VPC_SUBNET_AZ1"] as string);
    const subnetAz2 = Subnet.fromSubnetId(this, 'subnet_az2', props.dotenvVars["AWS_VPC_SUBNET_AZ2"] as string);

    const lambdaSecurityGroup = new SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: vpc,
      description: 'Default security group for Meadowlark Lambda functions, allows all outbound traffic.',
      allowAllOutbound: true,
    });

    const interfaceSecurityGroup = new SecurityGroup(this, 'InterfaceSecurityGroup', {
      vpc: vpc,
      description: 'Default security group for Meadowlark VPC Interface, allows all outbound traffic.',
      allowAllOutbound: true,
    });

    const apiGatewayEndpoint = vpc.addInterfaceEndpoint('ApiGatewayEndpoint', {
      service: InterfaceVpcEndpointAwsService.APIGATEWAY,
      subnets: {
        subnets: [subnetAz1, subnetAz2]
      },
      privateDnsEnabled: false,
      securityGroups: [interfaceSecurityGroup],
    });

    const apiGatewayPolicyDocument = new iam.PolicyDocument({
      statements: [
        // new iam.PolicyStatement({
        //   principals: [new iam.AnyPrincipal],
        //   actions: ['execute-api:Invoke'],
        //   resources: ['execute-api:/*'],
        //   effect: iam.Effect.DENY,
        //   conditions: {
        //     StringNotEquals: {
        //       "aws:SourceVpce": apiGatewayEndpoint.vpcEndpointId
        //     }
        //   }
        // }),
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          principals: [new iam.AnyPrincipal()],
          actions: ["execute-api:Invoke"],
          resources: ["execute-api:/*/*/*"],
          conditions: {
            NotIpAddress: {
              "aws:SourceIp": ["164.92.0.0/18"]
            }
          }
        }),
        new iam.PolicyStatement({
          principals: [new iam.AnyPrincipal],
          actions: ['execute-api:Invoke'],
          resources: ['execute-api:/*'],
          effect: iam.Effect.ALLOW
        })
      ]
    });


    /**
     * Api Gateway providing supporting apis for authentication/etc
     */
    const meadowlarkSupportingApi = new RestApi(this, 'MeadowlarkApi_Supporting', {
      restApiName: 'MeadowlarkSupportingApi',
      deploy: false,
      // endpointTypes: [EndpointType.PRIVATE],
      policy: apiGatewayPolicyDocument,
    });

    const envVars = props.dotenvVars;
    const prevGatewayUrl = "https://9dkid3abbe.execute-api.us-west-2.amazonaws.com"; // This has been hardcoded because we can't create the lambda functions without the info that is needed to generate the info, therefore we have to create the whole stack and then update it with the corrected env vars.
    envVars["OAUTH_SERVER_ENDPOINT_FOR_OWN_TOKEN_REQUEST"] = `${prevGatewayUrl}/${Config.get('MEADOWLARK_STAGE')}/oauth/token`;
    envVars["OAUTH_SERVER_ENDPOINT_FOR_TOKEN_VERIFICATION"] = `${prevGatewayUrl}/${Config.get('MEADOWLARK_STAGE')}/oauth/verify`;

    const functionProps: Partial<FunctionProps> = {
      code: Code.fromAsset(join(__dirname, '../lambda/meadowlark-lambda-functions/meadowlark-lambda-functions.zip')),
      environment: {
        // Add defaults here
        ...props.dotenvVars as unknown as { [key: string]: string } // Weird hack
      },
      runtime: Runtime.NODEJS_16_X,
      vpc: vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSecurityGroup],
      timeout: Duration.minutes(5),
    }

    /**
     * CRUD Handlers
     */
    const lambdaUpsertHandler = new Function(this, 'meadowlarkUpsertHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.postHandler',
    });

    const lambdaGetHandler = new Function(this, 'meadowlarkGetHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.getHandler',
    });

    const lambdaDeleteHandler = new Function(this, 'meadowlarkDeleteHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.deleteHandler',
    });

    const lambdaPutHandler = new Function(this, 'meadowlarkPutHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.putHandler',
    });

    /**
     * Authorization Handlers
     */
    const lambdaCreateAuthorizationClientHandler = new Function(this, 'meadowlarkCreateAuthorizationClientHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.createAuthorizationClientHandler',
    });

    const lambdaUpdateAuthorizationClientHandler = new Function(this, 'meadowlarkUpdateAuthorizationClientHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.updateAuthorizationClientHandler',
    });

    const lambdaRequestTokenAuthorizationHandler = new Function(this, 'meadowlarkRequestTokenAuthorizationHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.requestTokenAuthorizationHandler',
    });

    const lambdaVerifyTokenAuthorizationHandler = new Function(this, 'meadowlarkVerifyTokenAuthorizationHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.verifyTokenAuthorizationHandler',
    });

    const lambdaResetAuthorizationClientSecretHandler = new Function(this, 'meadowlarkResetAuthorizationClientSecretHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.resetAuthorizationClientSecretHandler',
    });

    const lambdaCreateSigningKeyHandler = new Function(this, 'meadowlarkCreateSigningKeyHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.createSigningKeyHandler',
    });

    const lambdaGetClientByIdHandler = new Function(this, 'meadowlarkGetClientByIdHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.getClientByIdHandler',
    });

    const lambdaGetClientsHandler = new Function(this, 'meadowlarkGetClientsHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.getClientsHandler',
    });

    /**
     * Metadata and Other Functions
     */
    const loadDescriptorsHandler = new Function(this, 'meadowlarkLoadDescriptorsHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.descriptorLoaderHandler',
    })

    const lambdaMetaedHandler = new Function(this, 'meadowlarkMetaedHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.metaedHandler',
    });

    const lambdaApiVersionHandler = new Function(this, 'meadowlarkApiVersionHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.apiVersionHandler',
    });

    const lambdaSwaggerForResourcesAPIHandler = new Function(this, 'meadowlarkSwaggerForResourcesAPIHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.swaggerForResourcesAPIHandler',
    });

    const lambdaOpenApiUrlListHandler = new Function(this, 'meadowlarkOpenApiUrlListHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.openApiUrlListHandler',
    });

    const lambdaSwaggerForDescriptorsAPIHandler = new Function(this, 'meadowlarkSwaggerForDescriptorsAPIHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.swaggerForDescriptorsAPIHandler',
    });

    const lambdaDependenciesHandler = new Function(this, 'meadowlarkDependenciesHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.dependenciesHandler',
    });

    const lambdaXsdMetadataHandler = new Function(this, 'meadowlarkXsdMetadataHandler', {
      ...functionProps as FunctionProps,
      handler: 'handler.xsdMetadataHandler',
    });
    
    /**
     * ApiGateway Execution Role
     */
    // Create IAM role for API Gateway
    const apiGatewayRole = new iam.Role(this, 'ApiGatewayRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    /**
     * CRUD Handlers
     */
    /**
    // Alternative to Spec API for crud handling*/
    const upsertIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaUpsertHandler, apiGatewayRole);
    const getIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaGetHandler, apiGatewayRole);
    const deleteIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaDeleteHandler, apiGatewayRole);
    const putIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaPutHandler, apiGatewayRole);

    /**
     * Authorization Handlers
     */
    const createAuthorizationClientIntegration = new LambdaIntegration(lambdaCreateAuthorizationClientHandler);
    const updateAuthorizationClientIntegration = new LambdaIntegration(lambdaUpdateAuthorizationClientHandler);
    const requestTokenAuthorizationIntegration = new LambdaIntegration(lambdaRequestTokenAuthorizationHandler);
    const verifyTokenAuthorizationIntegration = new LambdaIntegration(lambdaVerifyTokenAuthorizationHandler);
    const resetAuthorizationClientSecretIntegration = new LambdaIntegration(lambdaResetAuthorizationClientSecretHandler);
    const createSigningKeyIntegration = new LambdaIntegration(lambdaCreateSigningKeyHandler);
    const getClientByIdIntegration = new LambdaIntegration(lambdaGetClientByIdHandler);
    const getClientsIntegration = new LambdaIntegration(lambdaGetClientsHandler);

    /**
     * Metadata and Other Functions
     */
    const loadDescriptorsIntegration = new LambdaIntegration(loadDescriptorsHandler);
    const metaedIntegration = new LambdaIntegration(lambdaMetaedHandler);
    const apiVersionIntegration = new LambdaIntegration(lambdaApiVersionHandler);
    const swaggerForResourcesAPIIntegration = new LambdaIntegration(lambdaSwaggerForResourcesAPIHandler);
    const openApiUrlListIntegration = new LambdaIntegration(lambdaOpenApiUrlListHandler);
    const swaggerForDescriptorsAPIIntegration = new LambdaIntegration(lambdaSwaggerForDescriptorsAPIHandler);
    const dependenciesIntegration = new LambdaIntegration(lambdaDependenciesHandler);
    const xsdMetadataIntegration = new LambdaIntegration(lambdaXsdMetadataHandler);


    /**
     * API Gateway Services
     */
    // const resourcesSpec = addLambdaCrudHandlers(rOmit(rOmit(JSON.parse(props.resourcesSwaggerDefinition), 'description'), 'summary'), crudHandlers, apiGatewayRole)
    // const descriptorsSpec = addLambdaCrudHandlers(rOmit(rOmit(JSON.parse(props.descriptorsSwaggerDefinition), 'description'), 'summary'), crudHandlers, apiGatewayRole)

    // const meadowlarkResourcesApi = new SpecRestApi(this, 'MeadowlarkApi_Resources', {
    //   apiDefinition: ApiDefinition.fromInline(resourcesSpec)
    // });

    // const meadowlarkDescriptorsApi = new SpecRestApi(this, 'MeadowlarkApi_Descriptors', {
    //   apiDefinition: ApiDefinition.fromInline(descriptorsSpec)
    // });

    const rootResource = meadowlarkSupportingApi.root;

    /**
    // Alternative to Spec API for crud handling*/
    const apiRoot = rootResource.addResource('{api+}')
    apiRoot.addMethod('GET', getIntegration);
    apiRoot.addMethod('POST', upsertIntegration);
    apiRoot.addMethod('PUT', putIntegration);
    apiRoot.addMethod('DELETE', deleteIntegration);
    rootResource.addMethod('GET', apiVersionIntegration);

    rootResource.addResource('metaed').addMethod('GET', metaedIntegration);

    const metadataResource = rootResource.addResource('metadata');
    metadataResource.addMethod('GET', openApiUrlListIntegration);
    metadataResource.addResource('resources').addResource('swagger.json').addMethod('GET', swaggerForResourcesAPIIntegration);
    metadataResource.addResource('descriptors').addResource('swagger.json').addMethod('GET', swaggerForDescriptorsAPIIntegration);
    metadataResource.addResource('data').addResource('v3').addResource('dependencies').addMethod('GET', dependenciesIntegration);
    metadataResource.addResource('xsd').addMethod('GET', xsdMetadataIntegration);

    rootResource.addResource('loadDescriptors').addMethod('GET', loadDescriptorsIntegration);

    const oauthResource = rootResource.addResource('oauth');
    const clientsResource = oauthResource.addResource('clients');
    const cliendIdResource = clientsResource.addResource('{clientId}')
    clientsResource.addMethod('GET', getClientsIntegration);
    cliendIdResource.addMethod('GET', getClientByIdIntegration);
    cliendIdResource.addResource('reset').addMethod('POST', resetAuthorizationClientSecretIntegration);
    clientsResource.addMethod('POST', createAuthorizationClientIntegration);
    clientsResource.addMethod('PUT', updateAuthorizationClientIntegration);
    oauthResource.addResource('token').addMethod('POST', requestTokenAuthorizationIntegration);
    oauthResource.addResource('verify').addMethod('POST', verifyTokenAuthorizationIntegration);
    oauthResource.addResource('createSigningKey').addMethod('GET', createSigningKeyIntegration);

    // Assume the rate limit is in requests per second
    const rateLimit = Config.get<number>('FASTIFY_RATE_LIMIT');

    // Define a deployment of the API
    const deployment = new Deployment(this, 'MeadowlarkDeployment', {
      api: meadowlarkSupportingApi,
    });

    // Define stage properties
    const stage: string = Config.get('MEADOWLARK_STAGE');
    let stageProps: StageProps = {
      deployment: deployment,
      stageName: stage
    };

    if (rateLimit > 0) {
      // Add rate limiter, taking the defaults. Note this uses an in-memory store by default, better multi-server
      // effectiveness requires configuring for redis or an alternative store
      stageProps = {
        ...stageProps,
        throttlingRateLimit: rateLimit, // Requests per second
        throttlingBurstLimit: 2 * rateLimit // Maximum concurrent requests
      }
    }

    // Define & Assoc a stage that points to the deployment with the specified properties
    meadowlarkSupportingApi.deploymentStage = new Stage(this, 'MeadowlarkApiStage', stageProps);
  }

  private createLambdaIntegrationWithProvisionedConcurrency(handler: cdk.aws_lambda.Function, apiGatewayRole: iam.Role) {
    const version = new Version(this, `Version_${uniqueId()}`, {
      lambda: handler
    });

    // lambda function with custom applicaton auto scaler metric
    const pcHandler = new AutoscaleProvisionedConcurrentLambda(this, `pcHandler${uniqueId()}`, {
      handler: version,
      metricType: MetricType.Maximum
    });

    pcHandler.handler.grantInvoke(apiGatewayRole);

    return new LambdaIntegration(pcHandler.handler);
  }
}

function rOmit(obj: object, key: string) {
  if (isObject(obj)) {
    return transform(obj, (result: object, value: object, currentKey: string) => {
      if (currentKey !== key) {
        result[currentKey] = rOmit(value, key);
      }
    });
  } else {
    return obj;
  }
};

function addLambdaCrudHandlers(spec: any, crudHandlers: { [method: string]: NodejsFunction }, apiGatewayRole: iam.Role): object {
  for (const path in spec.paths) {
    for (const method in spec.paths[path]) {
      if (crudHandlers[method.toLowerCase()]) {
        spec.paths[path][method]['x-amazon-apigateway-integration'] = {
          'credentials': apiGatewayRole.roleArn,
          'uri': {
            'Fn::Sub': `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${crudHandlers[method.toLowerCase()].functionArn}/invocations`
          },
          'responses': {
            'default': {
              'statusCode': '400'
            }
          },
          'httpMethod': method.toUpperCase(),
          'type': 'aws_proxy'
        }
      }
    }
  }

  return spec;
}

function addCorsOptions(apiResource: IResource) {
  apiResource.addMethod('OPTIONS', new MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  })
}
