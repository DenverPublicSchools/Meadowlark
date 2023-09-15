export * from './handler';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import bootstrap from './utilities/BootstrapMeadowlark';
import { respondWith } from './MeadowlarkConverter';

/**
 * Lambda Function for all API GET requests
 */
let isBootstrapped: boolean = false;
bootstrap().then((result: boolean) => isBootstrapped = result)
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
    console.log("handler in index called");
    return {
        statusCode: 200,
        body: null
    }
}