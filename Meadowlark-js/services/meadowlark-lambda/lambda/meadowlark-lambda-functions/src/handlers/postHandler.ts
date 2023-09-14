import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../MeadowlarkConverter';
import {
  upsert as meadowlarkUpsert,
} from '@edfi/meadowlark-core';
import { bootstrap } from '../utilities/BootstrapMeadowlark';

/**
 * Lambda Function for all API POST requests
 */
let isBootstrapped: boolean = false;
bootstrap().then((result: boolean) => isBootstrapped = result)
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  isBootstrapped = !isBootstrapped ? await bootstrap() : isBootstrapped;
  return respondWith(await meadowlarkUpsert(fromRequest(event)));
}