import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Config, LOCATION_HEADER_NAME } from '@edfi/meadowlark-utilities';
import { newFrontendRequest } from '@edfi/meadowlark-core';
import type { FrontendRequest, FrontendResponse } from '@edfi/meadowlark-core';
import { extractPath, getHeaders, CompatibleParameters } from './LambdaUtility';

export function fromRequest(event: APIGatewayProxyEvent): FrontendRequest {
  return {
    ...newFrontendRequest(),
    path: extractPath(event, Config.get('MEADOWLARK_STAGE')),
    traceId: event.requestContext.requestId,
    body: event.body as string,
    headers: getHeaders(event),
    queryParameters: (event.queryStringParameters as CompatibleParameters) ?? {},
    stage: Config.get('MEADOWLARK_STAGE'),
  };
}

export function respondWith(frontendResponse: FrontendResponse): APIGatewayProxyResult {
  let headers = frontendResponse.headers || {};

  if (headers != null) {
    const locationHeader: string | undefined = headers[LOCATION_HEADER_NAME];
    if (locationHeader != null) {
      // Need to add the stage to the location header, url will be of form `/path/resource`
      headers[LOCATION_HEADER_NAME] = `/${Config.get('MEADOWLARK_STAGE')}${locationHeader}`;
    }
  }

  let body = typeof frontendResponse.body === 'string'
    ? frontendResponse.body
    : JSON.stringify(frontendResponse.body);

  return {
    statusCode: frontendResponse.statusCode,
    body: body,
    headers: headers,
    isBase64Encoded: false
  };
}  
