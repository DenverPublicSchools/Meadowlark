// Migrated from meadowlark-mongodb-backend
/**
 * Modifications:
 */

import { DynamoDBClient, CreateTableCommand, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { Logger, Config } from '@edfi//meadowlark-utilities';

export const DOCUMENT_COLLECTION_NAME = 'documents';
export const AUTHORIZATION_COLLECTION_NAME = 'authorizations';

let singletonClient: DynamoDBClient | null = null;

/**
 * Return a brand new client - which is a connection pool.
 */
export async function getNewClient(): Promise<DynamoDBClient> {
  const awsRegion: string = Config.get('AWS_REGION');
  // TODO: dynamo credentials?

  try {
    const newClient: DynamoDBClient = new DynamoDBClient({
      region: awsRegion
    })
    // No need to connect with Dynamo as the constructor handles this

    // Create indexed documents collection if not exists
    createDocumentsTable(newClient);

    // Create authorizations collection if not exists
    createAuthorizationsTable(newClient);

    return newClient;
  } catch (e) { // Log and throw... really? - MaxP
    const message = e instanceof Error ? e.message : 'unknown';
    Logger.error(`Error connecting to DynamoDB. Error was ${message}`, null);
    throw e;
  }
}

/**
 * Close and discard the current shared client. Only use for testing purposes
 */
export async function resetSharedClient(): Promise<void> {
  if (singletonClient != null) {
    await singletonClient.destroy();
  }
  singletonClient = null;
}

/**
 * Close and discard the current shared client. Only use for testing purposes.
 */
export async function closeSharedConnection(): Promise<void> {
  if (singletonClient != null) {
    await singletonClient.destroy();
  }
  singletonClient = null;
  Logger.info(`MongoDb connection: closed`, null);
}

/**
 * Return the shared client
 */
export async function getSharedClient(): Promise<DynamoDBClient> {
  if (singletonClient == null) {
    singletonClient = await getNewClient();
  }
  return singletonClient;
}

async function createDocumentsTable(client: DynamoDBClient){
  const params = {
    TableName: DOCUMENT_COLLECTION_NAME,
    KeySchema: [
      { AttributeName: "documentUuid", KeyType: "HASH" },
    ],
    AttributeDefinitions: [
      { AttributeName: "documentUuid", AttributeType: "S" },
      { AttributeName: "outboundRefs", AttributeType: "SS" },
      { AttributeName: "aliasIds", AttributeType: "SS" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "outboundRefsIndex",
        KeySchema: [{ AttributeName: "outboundRefs", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
      {
        IndexName: "aliasIdsIndex",
        KeySchema: [{ AttributeName: "aliasIds", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    await client.send(new CreateTableCommand(params));
  } catch (err) {
    Logger.error(`Error creating table 'indexed documents collection'`, null);
  }
}

async function createAuthorizationsTable(client: DynamoDBClient) {
  const params = {
    TableName: AUTHORIZATION_COLLECTION_NAME,
    KeySchema: [
      { AttributeName: "clientName", KeyType: "HASH" },
    ],
    AttributeDefinitions: [
      { AttributeName: "clientName", AttributeType: "S" },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  };

  try {
    await client.send(new CreateTableCommand(params));
  } catch (err) {
    Logger.error(`Error creating table 'indexed authorizations collection'`, null);
  }
}

export function getDocumentCollection() {
  return DOCUMENT_COLLECTION_NAME;
}

export function getAuthorizationCollection() {
  return AUTHORIZATION_COLLECTION_NAME;
}

export async function deleteTable(client: DynamoDBClient, tableName: string): Promise<void> {
  try {
    const deleteTableCommand = new DeleteTableCommand({ TableName: tableName });
    await client.send(deleteTableCommand);
    console.log(`Deleted table: ${tableName}`);
  } catch (error) {
    // Handle errors if the table does not exist or other issues
    console.error(`Failed to delete table: ${tableName}. Error:`, error);
  }
}

/**
 * 
 * @deprecated dynamo DB is atomic by default, use Conditional Writes instead
 */
export async function writeLockReferencedDocuments(
  _0: undefined,
  _1: string[],
  _2: undefined,
): Promise<void> { NOTIMPLEMENTED() }

export const onlyReturnId = {
  ProjectionExpression: "_id",
};

export const onlyReturnDocumentUuid = {
  ProjectionExpression: "documentUuid",
};

export const onlyReturnAliasId = {
  ProjectionExpression: "aliasIds[0]",
};

export const asUpsert = {
  ReturnValues: "ALL_OLD",
};

export const limitFive = {
  Limit: 5,
};

// Declare functions unusable
function NOTIMPLEMENTED() { throw new Error("Not implemented");}
