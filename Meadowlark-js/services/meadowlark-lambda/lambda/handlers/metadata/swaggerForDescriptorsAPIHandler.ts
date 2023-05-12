import * as Meadowlark from '@edfi/meadowlark-core';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../../MeadowlarkConverter';
import { bootstrap } from '../../utilities/BootstrapMeadowlark';

/**
 * Endpoint for accessing Descriptors API swagger metadata
 */
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  await bootstrap();
  return respondWith(await Meadowlark.swaggerForDescriptorsAPI(fromRequest(event)));
}