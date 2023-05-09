// Migrated from meadowlark-mongodb-backend
/**
 * Modifications:
 */

import { Logger } from "@edfi/meadowlark-utilities";
import { FrontendRequest, MeadowlarkId, meadowlarkIdForDocumentIdentity, writeRequestToLog } from "@edfi/meadowlark-core";
import { AttributeValue, DynamoDBClient, GetItemCommand, GetItemInput } from "@aws-sdk/client-dynamodb";
import { SecurityResult } from "../security/SecurityResult";
import { getDocumentCollection } from "./Db";
import { MeadowlarkDocument } from "../model/MeadowlarkDocument";
import { WithId } from "../model/WithId";

function extractIdIfUpsert(frontendRequest: FrontendRequest): MeadowlarkId | null {
  if (frontendRequest.action !== 'upsert') return null;

  return meadowlarkIdForDocumentIdentity(
    frontendRequest.middleware.resourceInfo,
    frontendRequest.middleware.documentInfo.documentIdentity,
  );
}

export async function rejectByOwnerShipSecurity(
  frontendRequest: FrontendRequest,
  client: DynamoDBClient,
): Promise<SecurityResult> {
  const moduleName = 'dynamodb.repository.OwnershipSecurity';
  const functionName = `${moduleName}.rejectByOwnerShipSecurity`;

  writeRequestToLog(moduleName, frontendRequest, 'rejectByOwnerShipSecurity')

  // If it's a GET request and a descriptor, ignore ownership
  if (
    frontendRequest.middleware.resourceInfo.isDescriptor &&
    (frontendRequest.action === 'getById' || frontendRequest.action === 'query')
  ) {
    Logger.debug('GET style request for a descriptor, bypassing ownership check', frontendRequest.traceId);
    return 'NOT_APPLICABLE';
  }

  const { documentUuid } = frontendRequest.middleware.pathComponents;
  const TableName = getDocumentCollection();

  let result: WithId<MeadowlarkDocument> | null = null;

  try {
    let key: Partial<Record<string, AttributeValue>> = {};

    if (documentUuid != null) {
      key.documentUuid = { S: documentUuid };
    } else {
      const meadowlarkId: MeadowlarkId | null = extractIdIfUpsert(frontendRequest);

      if (meadowlarkId == null) {
        Logger.error(`${functionName} - no documentUuid or meadowlarkId to secure against`, frontendRequest.traceId);
        return 'NOT_APPLICABLE';
      }

      key.meadowlarkId = { S: meadowlarkId };
    }

    const params: GetItemInput = {
      TableName: TableName,
      Key: key as Record<string, AttributeValue>,
      ProjectionExpression: 'createdBy',
    };

    const getItemCommand = new GetItemCommand(params);
    const data = await client.send(getItemCommand);
    // WARN: unsafe cast to MeadowlarkDocument
    result = data.Item ? (data.Item as unknown as WithId<MeadowlarkDocument>) : null;

    if (result === null) {
      Logger.debug(`${functionName} - document not found for ${JSON.stringify(key)}`, frontendRequest.traceId);
      return 'NOT_APPLICABLE';
    }
    Logger.debug(`${functionName} - document found for ${JSON.stringify(key)}`, frontendRequest.traceId);

    const { clientId } = frontendRequest.middleware.security;
    if (result.createdBy === clientId) {
      Logger.debug(`${functionName} - access approved for clientId ${clientId}`, frontendRequest.traceId);
      return 'ACCESS_APPROVED';
    }

    Logger.debug(`${functionName} - access denied for clientId ${clientId}`, frontendRequest.traceId);
    return 'ACCESS_DENIED';
  } catch (e) {
    return 'UNKNOWN_FAILURE';
  }
}
