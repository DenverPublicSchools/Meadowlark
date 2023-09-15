import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { loadDescriptors as meadowlarkLoadDescriptors } from '@edfi/meadowlark-core';
import bootstrap from '../utilities/BootstrapMeadowlark';

/**
 * A trigger to call the loadDescriptors function via a AWS Lambda function.
 * Only available when the stage is explicitly set to "local".
 */
export async function handler(_event: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> {
  await bootstrap(); //FIXME: this need to behave like all other functions
  if (process.env.MEADOWLARK_STAGE !== 'local') {
    return {
      statusCode: 404,
      body: '',
      isBase64Encoded: false
    };
  }

  await meadowlarkLoadDescriptors();

  return {
    statusCode: 202,
    body: '',
    isBase64Encoded: false
  };
}