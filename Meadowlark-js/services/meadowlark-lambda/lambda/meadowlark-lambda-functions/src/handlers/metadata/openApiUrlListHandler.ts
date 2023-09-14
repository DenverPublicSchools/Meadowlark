import * as Meadowlark from '@edfi/meadowlark-core';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../../MeadowlarkConverter';
import { bootstrap } from '../../utilities/BootstrapMeadowlark';

/*
 * Endpoint for listing available Open API metadata descriptions
 */
let isBootstrapped: boolean = false;
bootstrap().then((result: boolean) => isBootstrapped = result)
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  isBootstrapped = !isBootstrapped ? await bootstrap() : isBootstrapped;
  return respondWith(await Meadowlark.openApiUrlList(fromRequest(event)));
}