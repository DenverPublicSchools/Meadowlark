// Migrated from meadowlark-mongodb-backend
/**
 * Modifications:
 * - Changed from MongoClient to DynamoClient
 */

import { MiddlewareModel, writeRequestToLog } from "@edfi/meadowlark-core";
import { Logger } from '@edfi/meadowlark-utilities';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { rejectByOwnerShipSecurity } from '../repository/OwnershipSecurity';
import { SecurityResult } from "./SecurityResult";

/**
 * Enforces document store authorization for this backend
 */
export async function securityMiddleware(
  { frontendRequest, frontendResponse }: MiddlewareModel,
  client: DynamoDBClient,
): Promise<MiddlewareModel> {
  const moduleName = 'dynamodb.security.SecurityMiddleware';

  // if there is a response already posted, we are done
  if (frontendResponse != null) return { frontendRequest, frontendResponse };
  writeRequestToLog(moduleName, frontendRequest, 'securityMiddleware');

  // Ownership-based is the only onefor now. When others are implemented, do as
  // a stack of security middlewares with this as entry point
  if (frontendRequest.middleware.security.authorizationStrategy.type !== 'OWNERSHIP_BASED') {
    Logger.debug(`${moduleName}.securityMiddleware - ownership based security does not apply`, frontendRequest.traceId);
    return { frontendRequest, frontendResponse };
  }

  const securityResult: SecurityResult = await rejectByOwnerShipSecurity(frontendRequest, client);
  if (securityResult === 'ACCESS_APPROVED' || securityResult === 'NOT_APPLICABLE')
    return { frontendRequest, frontendResponse };

  if (securityResult === 'UNKNOWN_FAILURE')
    return { frontendRequest, frontendResponse: { statusCode: 500, headers: {}, body: '' } };
  
  return { frontendRequest, frontendResponse: {statusCode: 403, headers: {}, body: '' } };
}