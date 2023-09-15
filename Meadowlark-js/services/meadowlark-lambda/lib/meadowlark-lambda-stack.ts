import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DockerImageCode, Version, DockerImageFunctionProps, DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { join } from 'path';
import { RestApi, LambdaIntegration, Deployment, StageProps, Stage } from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Config } from '@edfi/meadowlark-utilities';
import { uniqueId } from 'lodash';
import { Vpc, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Duration } from 'aws-cdk-lib';
import { AutoscaleProvisionedConcurrentLambda, MetricType } from './construct/autoscale-provisioned-concurrent-lambda'

interface MeadowlarkStackProps extends cdk.StackProps {
  resourcesSwaggerDefinition: string;
  descriptorsSwaggerDefinition: string;
  dotenvVars: NodeJS.ProcessEnv;
}

export class MeadowlarkLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MeadowlarkStackProps) {
    super(scope, id, props);
    const vpc = Vpc.fromLookup(this, 'VPC', { vpcName: props.dotenvVars['AWS_VPC_NAME'] });

    const lambdaSecurityGroup = new SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: vpc,
      description: 'Default security group for Meadowlark Lambda functions, allows all outbound traffic.',
      allowAllOutbound: true,
    });

    const apiGatewayPolicyDocument = new iam.PolicyDocument({
      statements: [
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
    const prevGatewayUrl = "https://5nl4jol0fg.execute-api.us-west-2.amazonaws.com"; // This has been hardcoded because we can't create the lambda functions without the info that is needed to generate the info, therefore we have to create the whole stack and then update it with the corrected env vars.
    envVars["OAUTH_SERVER_ENDPOINT_FOR_OWN_TOKEN_REQUEST"] = `${prevGatewayUrl}/${Config.get('MEADOWLARK_STAGE')}/oauth/token`;
    envVars["OAUTH_SERVER_ENDPOINT_FOR_TOKEN_VERIFICATION"] = `${prevGatewayUrl}/${Config.get('MEADOWLARK_STAGE')}/oauth/verify`;

    const dockerFunctionProps = (handler: string): Partial<DockerImageFunctionProps> => {
      return {
        code: DockerImageCode.fromImageAsset(join(__dirname, '../lambda/meadowlark-lambda-functions'), {
          cmd: [handler],
        }),
        environment: {
          // Add defaults here
          ...props.dotenvVars as unknown as { [key: string]: string } // Weird hack
        },
        vpc: vpc,
        vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
        securityGroups: [lambdaSecurityGroup],
        timeout: Duration.minutes(5),
      }
    }

    /**
     * CRUD Handlers
     */
    const lambdaUpsertHandler = new DockerImageFunction(this, 'meadowlarkUpsertHandler', {
      ...dockerFunctionProps('handler.postHandler') as DockerImageFunctionProps
    });

    const lambdaGetHandler = new DockerImageFunction(this, 'meadowlarkGetHandler', {
      ...dockerFunctionProps('handler.getHandler') as DockerImageFunctionProps
    });

    const lambdaDeleteHandler = new DockerImageFunction(this, 'meadowlarkDeleteHandler', {
      ...dockerFunctionProps('handler.deleteHandler') as DockerImageFunctionProps
    });

    const lambdaPutHandler = new DockerImageFunction(this, 'meadowlarkPutHandler', {
      ...dockerFunctionProps('handler.putHandler') as DockerImageFunctionProps
    });

    /**
 * Authorization Handlers
 */
    const lambdaCreateAuthorizationClientHandler = new DockerImageFunction(this, 'meadowlarkCreateAuthorizationClientHandler', {
      ...dockerFunctionProps('handler.createAuthorizationClientHandler') as DockerImageFunctionProps
    });

    const lambdaUpdateAuthorizationClientHandler = new DockerImageFunction(this, 'meadowlarkUpdateAuthorizationClientHandler', {
      ...dockerFunctionProps('handler.updateAuthorizationClientHandler') as DockerImageFunctionProps
    });

    const lambdaRequestTokenAuthorizationHandler = new DockerImageFunction(this, 'meadowlarkRequestTokenAuthorizationHandler', {
      ...dockerFunctionProps('handler.requestTokenAuthorizationHandler') as DockerImageFunctionProps
    });

    const lambdaVerifyTokenAuthorizationHandler = new DockerImageFunction(this, 'meadowlarkVerifyTokenAuthorizationHandler', {
      ...dockerFunctionProps('handler.verifyTokenAuthorizationHandler') as DockerImageFunctionProps
    });

    const lambdaResetAuthorizationClientSecretHandler = new DockerImageFunction(this, 'meadowlarkResetAuthorizationClientSecretHandler', {
      ...dockerFunctionProps('handler.resetAuthorizationClientSecretHandler') as DockerImageFunctionProps
    });

    const lambdaCreateSigningKeyHandler = new DockerImageFunction(this, 'meadowlarkCreateSigningKeyHandler', {
      ...dockerFunctionProps('handler.createSigningKeyHandler') as DockerImageFunctionProps
    });

    const lambdaGetClientByIdHandler = new DockerImageFunction(this, 'meadowlarkGetClientByIdHandler', {
      ...dockerFunctionProps('handler.getClientByIdHandler') as DockerImageFunctionProps
    });

    const lambdaGetClientsHandler = new DockerImageFunction(this, 'meadowlarkGetClientsHandler', {
      ...dockerFunctionProps('handler.getClientsHandler') as DockerImageFunctionProps
    });

    /**
     * Metadata and Other Functions
     */
    const loadDescriptorsHandler = new DockerImageFunction(this, 'meadowlarkLoadDescriptorsHandler', {
      ...dockerFunctionProps('handler.descriptorLoaderHandler') as DockerImageFunctionProps
    });

    const lambdaMetaedHandler = new DockerImageFunction(this, 'meadowlarkMetaedHandler', {
      ...dockerFunctionProps('handler.metaedHandler') as DockerImageFunctionProps
    });

    const lambdaApiVersionHandler = new DockerImageFunction(this, 'meadowlarkApiVersionHandler', {
      ...dockerFunctionProps('handler.apiVersionHandler') as DockerImageFunctionProps
    });

    const lambdaSwaggerForResourcesAPIHandler = new DockerImageFunction(this, 'meadowlarkSwaggerForResourcesAPIHandler', {
      ...dockerFunctionProps('handler.swaggerForResourcesAPIHandler') as DockerImageFunctionProps
    });

    const lambdaOpenApiUrlListHandler = new DockerImageFunction(this, 'meadowlarkOpenApiUrlListHandler', {
      ...dockerFunctionProps('handler.openApiUrlListHandler') as DockerImageFunctionProps
    });

    const lambdaSwaggerForDescriptorsAPIHandler = new DockerImageFunction(this, 'meadowlarkSwaggerForDescriptorsAPIHandler', {
      ...dockerFunctionProps('handler.swaggerForDescriptorsAPIHandler') as DockerImageFunctionProps
    });

    const lambdaDependenciesHandler = new DockerImageFunction(this, 'meadowlarkDependenciesHandler', {
      ...dockerFunctionProps('handler.dependenciesHandler') as DockerImageFunctionProps
    });

    const lambdaXsdMetadataHandler = new DockerImageFunction(this, 'meadowlarkXsdMetadataHandler', {
      ...dockerFunctionProps('handler.xsdMetadataHandler') as DockerImageFunctionProps
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
    const createAuthorizationClientIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaCreateAuthorizationClientHandler, apiGatewayRole);
    const updateAuthorizationClientIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaUpdateAuthorizationClientHandler, apiGatewayRole);
    const requestTokenAuthorizationIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaRequestTokenAuthorizationHandler, apiGatewayRole);
    const verifyTokenAuthorizationIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaVerifyTokenAuthorizationHandler, apiGatewayRole);
    const resetAuthorizationClientSecretIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaResetAuthorizationClientSecretHandler, apiGatewayRole);
    const createSigningKeyIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaCreateSigningKeyHandler, apiGatewayRole);
    const getClientByIdIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaGetClientByIdHandler, apiGatewayRole);
    const getClientsIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaGetClientsHandler, apiGatewayRole);

    /**
     * Metadata and Other Functions
     */
    const loadDescriptorsIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(loadDescriptorsHandler, apiGatewayRole);
    const metaedIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaMetaedHandler, apiGatewayRole);
    const apiVersionIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaApiVersionHandler, apiGatewayRole);
    const swaggerForResourcesAPIIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaSwaggerForResourcesAPIHandler, apiGatewayRole);
    const openApiUrlListIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaOpenApiUrlListHandler, apiGatewayRole);
    const swaggerForDescriptorsAPIIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaSwaggerForDescriptorsAPIHandler, apiGatewayRole);
    const dependenciesIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaDependenciesHandler, apiGatewayRole);
    const xsdMetadataIntegration = this.createLambdaIntegrationWithProvisionedConcurrency(lambdaXsdMetadataHandler, apiGatewayRole);

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
