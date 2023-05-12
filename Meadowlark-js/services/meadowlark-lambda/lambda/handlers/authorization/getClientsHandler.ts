import {
  getClients,
} from '@edfi/meadowlark-authz-server';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../../AuthorizationConverter';
import { bootstrap } from '../../utilities/BootstrapMeadowlark';

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  await bootstrap();
  return respondWith(await getClients(fromRequest(event)));
}