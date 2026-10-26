import type { LambdaDBClient, ListDocsInput } from "@functional-systems/lambdadb";
import type { ListDocsExtendedRequestBody, ListDocsRequest } from "@functional-systems/lambdadb/models/operations";

const nullable: ListDocsInput = { size: null, pageToken: null, filter: null };
const body: ListDocsExtendedRequestBody = nullable;
// @ts-expect-error GET List does not accept nullable query parameters.
const get: ListDocsRequest = { collectionName: "test", size: null };
void get;
void body;
export async function read(client: LambdaDBClient) {
  const docs = client.collection("test").docs;
  await docs.list(nullable);
  await docs.listSafe(nullable);
  await docs.listAll(nullable);
  for await (const page of docs.listPages(nullable)) void page;
  await docs.fetch({ ids: ["one"] });
}
