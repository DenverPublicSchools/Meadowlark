import * as Meadowlark from '@edfi/meadowlark-core';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../../MeadowlarkConverter';

/**
 * Endpoint for accessing Resources API swagger metadata
 */
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  return respondWith(await Meadowlark.swaggerForResourcesAPI(fromRequest(event)));
}