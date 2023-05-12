#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MeadowlarkLambdaStack } from '../lib/meadowlark-lambda-stack';
import { swaggerForResourcesAPI, swaggerForDescriptorsAPI, FrontendRequest, newFrontendRequest } from '@edfi/meadowlark-core';
import { Config, CachedEnvironmentConfigProvider, initializeLogging } from '@edfi/meadowlark-utilities';
import dotenv from 'dotenv';
import { cloneDeep, omit } from 'lodash';

async function main() {
  const originalEnv = cloneDeep(process.env);
  dotenv.config();
  const dotenvVars: NodeJS.ProcessEnv = omit(process.env, Object.keys(originalEnv));
  await Config.initializeConfig(CachedEnvironmentConfigProvider);
  initializeLogging();

  const mockRequest: FrontendRequest = {
    ...newFrontendRequest(),
    stage: process.env['MEADOWLARK_STAGE'] || ''
  }

  const app = new cdk.App();

  const resSpec = (await swaggerForResourcesAPI(mockRequest)).body;
  const descSpec = (await swaggerForDescriptorsAPI(mockRequest)).body;

  new MeadowlarkLambdaStack(app, 'MeadowlarkLambdaStack', {
    resourcesSwaggerDefinition: resSpec as string,
    descriptorsSwaggerDefinition: descSpec as string,
    dotenvVars
    /* If you don't specify 'env', this stack will be environment-agnostic.
     * Account/Region-dependent features and context lookups will not work,
     * but a single synthesized template can be deployed anywhere. */

    /* Uncomment the next line to specialize this stack for the AWS Account
     * and Region that are implied by the current CLI configuration. */
    // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

    /* Uncomment the next line if you know exactly what Account and Region you
     * want to deploy the stack to. */
    // env: { account: '123456789012', region: 'us-east-1' },
    /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  });
}
main().catch(console.error);
