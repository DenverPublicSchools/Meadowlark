import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../MeadowlarkConverter';
import {
  upsert as meadowlarkUpsert,
} from '@edfi/meadowlark-core';

/**
 * Lambda Function for all API POST requests
 */
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  return respondWith(await meadowlarkUpsert(fromRequest(event)));
}