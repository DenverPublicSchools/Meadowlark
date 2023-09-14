import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Config, LOCATION_HEADER_NAME } from '@edfi/meadowlark-utilities';
import { newAuthorizationRequest } from '@edfi/meadowlark-authz-server';
import type { AuthorizationRequest, AuthorizationResponse } from '@edfi/meadowlark-authz-server';
import { extractPath, getHeaders, CompatibleParameters } from './LambdaUtility';

export function fromRequest(event: APIGatewayProxyEvent): AuthorizationRequest {
  return {
    ...newAuthorizationRequest(),
    path: extractPath(event, Config.get('MEADOWLARK_STAGE')),
    traceId: event.requestContext.requestId,
    body: event.body as string,
    headers: getHeaders(event),
    queryParameters: (event.queryStringParameters as CompatibleParameters) ?? {},
    stage: Config.get('MEADOWLARK_STAGE'),
  };
}

export function respondWith(authorizationResponse: AuthorizationResponse): APIGatewayProxyResult {
  let headers = authorizationResponse.headers || {};

  if (headers != null) {
    const locationHeader: string | undefined = headers[LOCATION_HEADER_NAME];
    if (locationHeader != null) {
      // Need to add the stage to the location header, url will be of form `/path/resource`
      headers[LOCATION_HEADER_NAME] = `/${Config.get('MEADOWLARK_STAGE')}${locationHeader}`;
    }
  }

  let body = typeof authorizationResponse.body === 'string'
    ? authorizationResponse.body
    : JSON.stringify(authorizationResponse.body);

  return {
    statusCode: authorizationResponse.statusCode,
    body: body,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    isBase64Encoded: false
  };
}
