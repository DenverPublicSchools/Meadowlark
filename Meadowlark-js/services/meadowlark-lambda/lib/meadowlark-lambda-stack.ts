import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';
import dotenv from 'dotenv';
import { cloneDeep, omit } from 'lodash';
import { RestApi, IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, SpecRestApi, ApiDefinition } from 'aws-cdk-lib/aws-apigateway';
import { swaggerForResourcesAPI, swaggerForDescriptorsAPI, FrontendRequest, newFrontendRequest } from '@edfi/meadowlark-core';

const LAMBDAS = join(__dirname, 'lambda');

const originalEnv = cloneDeep(process.env);
dotenv.config();
const dotenvVars: NodeJS.ProcessEnv = omit(process.env, Object.keys(originalEnv));

interface MeadowlarkStackProps extends cdk.StackProps {
  resourcesSwaggerDefinition: string;
  descriptorsSwaggerDefinition: string;
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
      depsLockFilePath: join(LAMBDAS, 'package-lock.json'),
      environment: {
        // Add defaults here
        ...dotenvVars as unknown as { [key: string]: string } // Weird hack
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
    // const upsertIntegration = new LambdaIntegration(lambdaUpsertHandler);
    // const getIntegration = new LambdaIntegration(lambdaGetHandler);
    // const deleteIntegration = new LambdaIntegration(lambdaDeleteHandler);
    // const putIntegration = new LambdaIntegration(lambdaPutHandler);
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
     * API Gateway Services
     */
    const resourcesSpec = addLambdaCrudHandlers(JSON.parse(props.resourcesSwaggerDefinition), crudHandlers)
    const descriptorsSpec = addLambdaCrudHandlers(JSON.parse(props.descriptorsSwaggerDefinition), crudHandlers)

    const meadowlarkResourcesApi = new SpecRestApi(this, 'MeadowlarkApi_Resources', {
      apiDefinition: ApiDefinition.fromInline(resourcesSpec)
    });

    const meadowlarkDescriptorsApi = new SpecRestApi(this, 'MeadowlarkApi_Descriptors', {
      apiDefinition: ApiDefinition.fromInline(descriptorsSpec)
    });

    const meadowlarkSupportingApi = new RestApi(this, 'MeadowlarkApi_Supporting', {
      restApiName: 'MeadowlarkSupportingApi'
    });
  }
}

function addLambdaCrudHandlers(spec: any, crudHandlers: { [method: string]: NodejsFunction }) {
  for (const path in spec.paths) {
    for (const method in spec.paths[path]) {
      if (crudHandlers[method.toLowerCase()]) {
        spec.paths[path][method]['x-amazon-apigateway-integration'] = {
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
