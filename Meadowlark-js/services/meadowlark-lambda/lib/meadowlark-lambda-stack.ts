import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';
import { RestApi, IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, SpecRestApi, ApiDefinition, Deployment, StageProps, Stage } from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Config } from '@edfi/meadowlark-utilities';

const LAMBDAS = join(__dirname, '..', 'lambda');

interface MeadowlarkStackProps extends cdk.StackProps {
  resourcesSwaggerDefinition: string;
  descriptorsSwaggerDefinition: string;
  dotenvVars: NodeJS.ProcessEnv;
}

export class MeadowlarkLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MeadowlarkStackProps) {
    super(scope, id, props);

    const nodeJsFunctionProps: NodejsFunctionProps = {
      bundling: {
        externalModules: [
          'aws-sdk',
        ]
      },
      depsLockFilePath: join(LAMBDAS, '../../..', 'package-lock.json'),
      environment: {
        // Add defaults here
        ...props.dotenvVars as unknown as { [key: string]: string } // Weird hack
      },
      runtime: Runtime.NODEJS_16_X
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
    // Alternative to Spec API for crud handling
    // const upsertIntegration = new LambdaIntegration(lambdaUpsertHandler);
    // const getIntegration = new LambdaIntegration(lambdaGetHandler);
    // const deleteIntegration = new LambdaIntegration(lambdaDeleteHandler);
    // const putIntegration = new LambdaIntegration(lambdaPutHandler);
     */
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
    const resourcesSpec = addLambdaCrudHandlers(JSON.parse(props.resourcesSwaggerDefinition), crudHandlers, apiGatewayRole)
    const descriptorsSpec = addLambdaCrudHandlers(JSON.parse(props.descriptorsSwaggerDefinition), crudHandlers, apiGatewayRole)

    const meadowlarkResourcesApi = new SpecRestApi(this, 'MeadowlarkApi_Resources', {
      apiDefinition: ApiDefinition.fromInline(resourcesSpec)
    });

    const meadowlarkDescriptorsApi = new SpecRestApi(this, 'MeadowlarkApi_Descriptors', {
      apiDefinition: ApiDefinition.fromInline(descriptorsSpec)
    });

    const meadowlarkSupportingApi = new RestApi(this, 'MeadowlarkApi_Supporting', {
      restApiName: 'MeadowlarkSupportingApi'
    });

    const rootResource = meadowlarkSupportingApi.root;

    /**
    // Alternative to Spec API for crud handling
    // meadowlarkSupportingApi.root.addMethod('GET', getIntegration);
    // meadowlarkSupportingApi.root.addMethod('POST', upsertIntegration);
    // meadowlarkSupportingApi.root.addMethod('PUT', putIntegration);
    // meadowlarkSupportingApi.root.addMethod('DELETE', deleteIntegration);
     */

    rootResource.addResource('metaed').addMethod('GET', metaedIntegration);

    rootResource.addMethod('GET', apiVersionIntegration);
    const metadataResource = rootResource.addResource('metadata');
    metadataResource.addMethod('GET', openApiUrlListIntegration);
    metadataResource.addResource('resources').addResource('swagger.json').addMethod('GET', swaggerForResourcesAPIIntegration);
    metadataResource.addResource('descriptors').addResource('swagger.json').addMethod('GET', swaggerForDescriptorsAPIIntegration);
    metadataResource.addResource('data').addResource('v3').addResource('dependencies').addMethod('GET', dependenciesIntegration);
    metadataResource.addResource('xsd').addMethod('GET', xsdMetadataIntegration);

    rootResource.addResource('loadDescriptors').addMethod('GET', loadDescriptorsIntegration);

    const oauthResource = rootResource.addResource('oauth');
    oauthResource.addResource('clients').addMethod('GET', getClientsIntegration);
    oauthResource.addResource('clients').addResource('{clientId}').addMethod('GET', getClientByIdIntegration);
    oauthResource.addResource('clients').addResource('{clientId}').addResource('reset').addMethod('POST', resetAuthorizationClientSecretIntegration);
    oauthResource.addResource('clients').addMethod('POST', createAuthorizationClientIntegration);
    oauthResource.addResource('clients').addMethod('PUT', updateAuthorizationClientIntegration);
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

function addLambdaCrudHandlers(spec: any, crudHandlers: { [method: string]: NodejsFunction }, apiGatewayRole: iam.Role) {
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
