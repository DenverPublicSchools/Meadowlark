export * from './handler';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler, Context } from 'aws-lambda';

/**
 * Lambda Function for all API GET requests
 */
export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    console.log("handler in index called");
    return {
        statusCode: 200,
        body: null
    }
}