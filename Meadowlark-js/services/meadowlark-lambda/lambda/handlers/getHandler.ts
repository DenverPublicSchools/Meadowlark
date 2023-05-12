import {
  get as meadowlarkGet,
} from '@edfi/meadowlark-core';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../MeadowlarkConverter';
import { bootstrap } from '../utilities/BootstrapMeadowlark';

/**
 * Lambda Function for all API GET requests
 */
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  await bootstrap();
  return respondWith(await meadowlarkGet(fromRequest(event)));
}