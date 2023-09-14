export * from './handler';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';
import { bootstrap } from './utilities/BootstrapMeadowlark';

/**
 * Lambda Function for all API GET requests
 */
let isBootstrapped: boolean = false;
bootstrap().then((result: boolean) => isBootstrapped = result)
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    isBootstrapped = !isBootstrapped ? await bootstrap() : isBootstrapped;
    console.log("handler in index called");
    return {
        statusCode: 200,
        body: null
    }
}