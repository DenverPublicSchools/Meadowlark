import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../MeadowlarkConverter';
import {
  upsert as meadowlarkUpsert,
} from '@edfi/meadowlark-core';
import bootstrap from '../utilities/BootstrapMeadowlark';

/**
 * Lambda Function for all API POST requests
 */
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
  return respondWith(await meadowlarkUpsert(fromRequest(event)));
}