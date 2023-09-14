import { APIGatewayProxyEvent } from 'aws-lambda';
import type { Headers } from '@edfi/meadowlark-core';

export type CompatibleParameters = { [header: string]: string | undefined };

// Returns header names lowercased
export function getHeaders(event: APIGatewayProxyEvent): Headers {
  const headers = (event.headers as CompatibleParameters) ?? {};
  headers.host = event.headers['Host'] || event.headers['host'];

  // ensure all header names are lowercased
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
}

export function extractPath(event: APIGatewayProxyEvent, stage: string): string {
  let path = event.path;

  // The path will be of the form `/{stage}/path/resource`. Need to remove the stage.
  // Ensure the leading slash is removed by checking for it explicitly
  let stageWithPath = '/' + stage;
  if (path.startsWith(stageWithPath)) {
    path = path.slice(stageWithPath.length);
  }

  return path;
}
