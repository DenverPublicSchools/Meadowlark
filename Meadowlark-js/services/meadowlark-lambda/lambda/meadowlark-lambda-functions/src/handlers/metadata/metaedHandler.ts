import * as Meadowlark from '@edfi/meadowlark-core';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../../MeadowlarkConverter';
import { bootstrap } from '../../utilities/BootstrapMeadowlark';

/**
 * An http handler for the metadata endpoint used for diagnostics. Loads the requested MetaEd
 * project and returns MetaEd project metadata in the response header.
 */
let isBootstrapped: boolean = false;
bootstrap().then((result: boolean) => isBootstrapped = result)
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  isBootstrapped = !isBootstrapped ? await bootstrap() : isBootstrapped;
  return respondWith(await Meadowlark.metaed(fromRequest(event)));
}