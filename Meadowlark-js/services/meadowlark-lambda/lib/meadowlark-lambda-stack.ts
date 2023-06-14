import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime, LayerVersion, Code, Architecture } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';
import { RestApi, IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, SpecRestApi, ApiDefinition, Deployment, StageProps, Stage, EndpointType } from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Config } from '@edfi/meadowlark-utilities';
import { isObject, transform } from 'lodash';
import { Vpc, GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService, SecurityGroup, SubnetType, Peer, Port, Subnet } from 'aws-cdk-lib/aws-ec2';
import { env } from 'process';
import { Duration } from 'aws-cdk-lib';

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

    const meadowlarkBackendLayer = new LayerVersion(this, 'MeadowlarkBackendsLayer', {
      layerVersionName: 'meadowlark-backend-plugins',
      compatibleRuntimes: [
        Runtime.NODEJS_16_X
      ],
      code: Code.fromAsset('./dist/layer'),
    });

    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        sourceMap: true,
        externalModules: [
          'aws-sdk',
          '@edfi/meadowlark-postgresql-backend',
          '@edfi/meadowlark-opensearch-backend',
          // '@edfi/meadowlark-core',
          // TODO: declare rest of meadowlark modules as external, and manually build them in package.json
        ],
        // loader: {
        //   '.json': 'file'
        // }
      },
      layers: [meadowlarkBackendLayer],
      depsLockFilePath: join(LAMBDAS, '../../..', 'package-lock.json'),
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
    const lambdaUpsertHandler = new NodejsFunction(this, 'meadowlarkUpsertHandler', {
      entry: join(LAMBDAS, 'handlers', 'postHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaGetHandler = new NodejsFunction(this, 'meadowlarkGetHandler', {
      entry: join(LAMBDAS, 'handlers', 'getHandler.ts'),
      ...nodeJsFunctionProps
    })

    const lambdaDeleteHandler = new NodejsFunction(this, 'meadowlarkDeleteHandler', {
      entry: join(LAMBDAS, 'handlers', 'deleteHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaPutHandler = new NodejsFunction(this, 'meadowlarkPutHandler', {
      entry: join(LAMBDAS, 'handlers', 'putHandler.ts'),
      ...nodeJsFunctionProps
    });

    /**
     * Authorization Handlers
     */
    const lambdaCreateAuthorizationClientHandler = new NodejsFunction(this, 'meadowlarkCreateAuthorizationClientHandler', {
      entry: join(LAMBDAS, 'handlers', 'authorization', 'createAuthorizationClientHandler.ts'),
      ...nodeJsFunctionProps
    })

    const lambdaUpdateAuthorizationClientHandler = new NodejsFunction(this, 'meadowlarkUpdateAuthorizationClientHandler', {
      entry: join(LAMBDAS, 'handlers', 'authorization', 'updateAuthorizationClientHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaRequestTokenAuthorizationHandler = new NodejsFunction(this, 'meadowlarkRequestTokenAuthorizationHandler', {
      entry: join(LAMBDAS, 'handlers', 'authorization', 'requestTokenAuthorizationHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaVerifyTokenAuthorizationHandler = new NodejsFunction(this, 'meadowlarkVerifyTokenAuthorizationHandler', {
      entry: join(LAMBDAS, 'handlers', 'authorization', 'verifyTokenAuthorizationHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaResetAuthorizationClientSecretHandler = new NodejsFunction(this, 'meadowlarkResetAuthorizationClientSecretHandler', {
      entry: join(LAMBDAS, 'handlers', 'authorization', 'resetAuthorizationClientSecretHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaCreateSigningKeyHandler = new NodejsFunction(this, 'meadowlarkCreateSigningKeyHandler', {
      entry: join(LAMBDAS, 'handlers', 'authorization', 'createSigningKeyHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaGetClientByIdHandler = new NodejsFunction(this, 'meadowlarkGetClientByIdHandler', {
      entry: join(LAMBDAS, 'handlers', 'authorization', 'getClientByIdHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaGetClientsHandler = new NodejsFunction(this, 'meadowlarkGetClientsHandler', {
      entry: join(LAMBDAS, 'handlers', 'authorization', 'getClientsHandler.ts'),
      ...nodeJsFunctionProps
    });

    /**
     * Metadata and Other Functions
     */
    const loadDescriptorsHandler = new NodejsFunction(this, 'meadowlarkLoadDescriptorsHandler', {
      entry: join(LAMBDAS, 'handlers', 'descriptorLoaderHandler.ts'),
      ...nodeJsFunctionProps
    })

    const lambdaMetaedHandler = new NodejsFunction(this, 'meadowlarkMetaedHandler', {
      entry: join(LAMBDAS, 'handlers', 'metadata', 'metaedHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaApiVersionHandler = new NodejsFunction(this, 'meadowlarkApiVersionHandler', {
      entry: join(LAMBDAS, 'handlers', 'metadata', 'apiVersionHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaSwaggerForResourcesAPIHandler = new NodejsFunction(this, 'meadowlarkSwaggerForResourcesAPIHandler', {
      entry: join(LAMBDAS, 'handlers', 'metadata', 'swaggerForResourcesAPIHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaOpenApiUrlListHandler = new NodejsFunction(this, 'meadowlarkOpenApiUrlListHandler', {
      entry: join(LAMBDAS, 'handlers', 'metadata', 'openApiUrlListHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaSwaggerForDescriptorsAPIHandler = new NodejsFunction(this, 'meadowlarkSwaggerForDescriptorsAPIHandler', {
      entry: join(LAMBDAS, 'handlers', 'metadata', 'swaggerForDescriptorsAPIHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaDependenciesHandler = new NodejsFunction(this, 'meadowlarkDependenciesHandler', {
      entry: join(LAMBDAS, 'handlers', 'metadata', 'dependenciesHandler.ts'),
      ...nodeJsFunctionProps
    });

    const lambdaXsdMetadataHandler = new NodejsFunction(this, 'meadowlarkXsdMetadataHandler', {
      entry: join(LAMBDAS, 'handlers', 'metadata', 'xsdMetadataHandler.ts'),
      ...nodeJsFunctionProps
    });

    /**
     * CRUD Handlers
     */
    /**
    // Alternative to Spec API for crud handling*/
    const upsertIntegration = new LambdaIntegration(lambdaUpsertHandler);
    const getIntegration = new LambdaIntegration(lambdaGetHandler);
    const deleteIntegration = new LambdaIntegration(lambdaDeleteHandler);
    const putIntegration = new LambdaIntegration(lambdaPutHandler);

    const crudHandlers = {
      'get': lambdaGetHandler,
      'put': lambdaPutHandler,
      'delete': lambdaDeleteHandler,
      'post': lambdaUpsertHandler
    }

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
     * ApiGateway Execution Role
     */
    // Create IAM role for API Gateway
    const apiGatewayRole = new iam.Role(this, 'ApiGatewayRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    // Grant necessary permissions
    for (const handler of Object.values(crudHandlers)) {
      handler.grantInvoke(apiGatewayRole);
    }

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
