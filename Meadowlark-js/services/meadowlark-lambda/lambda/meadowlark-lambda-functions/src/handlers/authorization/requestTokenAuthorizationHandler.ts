import {
  requestToken,
} from '@edfi/meadowlark-authz-server';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../../AuthorizationConverter';
import bootstrap from '../../utilities/BootstrapMeadowlark';

let isBootstrapped: boolean = false;
// bootstrap().then((result: boolean) => isBootstrapped = result)
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  if (!isBootstrapped) {
    bootstrap().then((result: boolean) => isBootstrapped = result); // this takes forever, so we return 503
    return respondWith({
      statusCode: 503,
      headers: {
        'Retry-After': '300'
      }
    })
  }
  return respondWith(await requestToken(fromRequest(event)));
}