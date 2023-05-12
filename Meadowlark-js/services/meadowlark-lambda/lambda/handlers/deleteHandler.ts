import {
  deleteIt as meadowlarkDelete,
} from '@edfi/meadowlark-core';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../MeadowlarkConverter';
import { bootstrap } from '../utilities/BootstrapMeadowlark';

/**
 * Lambda Function for all API DELETE requests, which are "by id"
 */
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  await bootstrap();
  return respondWith(await meadowlarkDelete(fromRequest(event)));
}