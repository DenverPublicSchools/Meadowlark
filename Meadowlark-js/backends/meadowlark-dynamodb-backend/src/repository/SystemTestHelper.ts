// Copied from meadowlark-mongodb-backend
/**
 * Modifications:
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { deleteTable, getDocumentCollection, getNewClient, resetSharedClient } from './Db';

export async function systemTestSetup(): Promise<DynamoDBClient> {
  const client = (await getNewClient()) as DynamoDBClient;
  await deleteTable(client, getDocumentCollection());
  return client;
}

export async function systemTestTeardown(client: DynamoDBClient): Promise<void> {
  await deleteTable(client, getDocumentCollection());
  await client.destroy();
  await resetSharedClient();
}