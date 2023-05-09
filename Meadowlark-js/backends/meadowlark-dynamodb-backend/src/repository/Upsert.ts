import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  UpsertResult,
  UpsertRequest,
  documentIdForSuperclassInfo,
  BlockingDocument,
  DocumentUuid,
  generateDocumentUuid,
} from '@edfi/meadowlark-core';
import { Logger, Config } from '@edfi/meadowlark-utilities';
import retry from 'async-retry';
import { MeadowlarkDocument, meadowlarkDocumentFrom } from '../model/MeadowlarkDocument';
import { WithId } from '../model/WithId';
import { asUpsert, limitFive, getDocumentCollection, onlyReturnDocumentUuid } from './Db';
import { onlyDocumentsReferencing, validateReferences } from './ReferenceValidation';

const moduleName: string = 'dynamodb.repository.Upsert';

export async function upsertDocumentTransaction(
  { resourceInfo, documentInfo, meadowlarkId, edfiDoc, validateDocumentReferencesExist, traceId, security }: UpsertRequest,
  tableName: string,
  dynamoDBClient: DynamoDBClient,
  documentFromUpdate?: MeadowlarkDocument,
): Promise<UpsertResult> {

  // Helper function to create a DynamoDB query key
  const createDynamoDbKey = (key: string) => {
    return {
      _id: { S: key },
    };
  };

  // Check whether this document exists in the db
  const getItemInput = {
    TableName: tableName,
    Key: createDynamoDbKey(meadowlarkId),
    ProjectionExpression: 'documentUuid',
  };

  const { Item: existingDocument } = await dynamoDBClient.send(new GetItemCommand(getItemInput));
  const existingDocumentUnmarshalled = existingDocument ? (unmarshall(existingDocument) as WithId<MeadowlarkDocument>) : null;

  // the documentUuid of the existing document if this is an update, or a new one if this is an insert
  const documentUuid: DocumentUuid | null = existingDocumentUnmarshalled?.documentUuid ?? generateDocumentUuid();

  // Check whether this is an insert or update
  const isInsert: boolean = existingDocumentUnmarshalled == null;

  // If inserting a subclass, check whether the superclass identity is already claimed by a different subclass
  if (isInsert && documentInfo.superclassInfo != null) {
    const superclassAliasId: string = documentIdForSuperclassInfo(documentInfo.superclassInfo);
    const queryInput = {
      TableName: tableName,
      KeyConditionExpression: 'aliasIds = :superclassAliasId',
      ExpressionAttributeValues: {
        ':superclassAliasId': { S: superclassAliasId },
      },
      Limit: 1,
    };

    const { Items } = await dynamoDBClient.send(new QueryCommand(queryInput));
    const superclassAliasIdInUse = Items && Items.length > 0 ? (unmarshall(Items[0]) as WithId<MeadowlarkDocument>) : null;

    if (superclassAliasIdInUse) {
      Logger.warn(
        `${moduleName}.upsertDocumentTransaction insert failed due to another subclass with documentUuid ${superclassAliasIdInUse.documentUuid} and the same identity ${superclassAliasIdInUse._id}`,
        traceId,
      );

      return {
        response: 'INSERT_FAILURE_CONFLICT',
        failureMessage: `Insert failed: the identity is in use by '${resourceInfo.resourceName}' which is also a(n) '${documentInfo.superclassInfo.resourceName}'`,
        blockingDocuments: [
          {
            documentUuid: superclassAliasIdInUse.documentUuid,
            resourceName: superclassAliasIdInUse.resourceName,
            projectName: superclassAliasIdInUse.projectName,
            resourceVersion: superclassAliasIdInUse.resourceVersion,
          },
        ],
      };
    }
  }

  if (validateDocumentReferencesExist) {
    const failures = await validateReferences(
      documentInfo.documentReferences,
      documentInfo.descriptorReferences,
      getDocumentCollection(),
      traceId,
    );

    // Abort on validation failure
    if (failures.length > 0) {
      Logger.debug(
        `${moduleName}.upsertDocumentTransaction Upserting document uuid ${documentUuid} failed due to invalid references`,
        traceId,
      );

      const scanInput = {
        TableName: tableName,
        FilterExpression: 'contains (outboundRefs, :meadowlarkId)',
        ExpressionAttributeValues: {
          ':meadowlarkId': { S: meadowlarkId },
        },
        Limit: 5,
      };
      
      const { Items } = await dynamoDBClient.send(new ScanCommand(scanInput));
      const referringDocuments = Items ? Items.map((item) => unmarshall(item) as WithId<MeadowlarkDocument>) : [];

      const blockingDocuments: BlockingDocument[] = referringDocuments.map((document) => ({
        documentUuid: document._id,
        resourceName: document.resourceName,
        projectName: document.projectName,
        resourceVersion: document.resourceVersion,
      }));

      return {
        response: isInsert ? 'INSERT_FAILURE_REFERENCE' : 'UPDATE_FAILURE_REFERENCE',
        failureMessage: { error: { message: 'Reference validation failed', failures } },
        blockingDocuments,
      };
    }
  }

  // Perform the document upsert
  // Perform the document upsert
  Logger.debug(`${moduleName}.upsertDocumentTransaction Upserting document uuid ${documentUuid}`, traceId);

  const document: MeadowlarkDocument =
    documentFromUpdate ??
    meadowlarkDocumentFrom(
      resourceInfo,
      documentInfo,
      documentUuid,
      meadowlarkId,
      edfiDoc,
      validateDocumentReferencesExist,
      security.clientId,
    );

  // Insert an item, DynamoDB handles upserting logic
  const putItemInput = {
    TableName: tableName,
    Item: marshall(document),
  };
  await dynamoDBClient.send(new PutItemCommand(putItemInput));
  return {
    response: 'INSERT_SUCCESS',
    newDocumentUuid: documentUuid,
  };
}