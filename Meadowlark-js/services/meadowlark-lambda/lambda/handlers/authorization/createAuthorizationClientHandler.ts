import {
  createClient,
} from '@edfi/meadowlark-authz-server';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { fromRequest, respondWith } from '../../AuthorizationConverter';

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  return respondWith(await createClient(fromRequest(event)));
}