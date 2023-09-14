import {
  createClient,
} from '@edfi/meadowlark-authz-server';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../../AuthorizationConverter';
import { bootstrap } from '../../utilities/BootstrapMeadowlark';

let isBootstrapped: boolean = false;
bootstrap().then((result: boolean) => isBootstrapped = result)
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  isBootstrapped = !isBootstrapped ? await bootstrap() : isBootstrapped;
  return respondWith(await createClient(fromRequest(event)));
}