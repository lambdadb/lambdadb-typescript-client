import type { LambdaDBClient, ListDocsInput, ListDocsSortField, ReadRef } from "@functional-systems/lambdadb";
import { aliasRef, branchRef, tagRef } from "@functional-systems/lambdadb";
import type { ListDocsExtendedRequestBody, ListDocsRequest } from "@functional-systems/lambdadb/models/operations";

const nullable: ListDocsInput = { size: null, pageToken: null, filter: null };
const body: ListDocsExtendedRequestBody = nullable;
// @ts-expect-error GET List does not accept nullable query parameters.
const get: ListDocsRequest = { collectionName: "test", size: null };
void get;
void body;

const sort: ListDocsSortField[] = [{ category: "asc" }, { price: "desc" }];
declare const anyRef: ReadRef;
const sortedLists: ListDocsInput[] = [
  { sort },
  { sort: null },
  { consistentRead: true },
  { consistentRead: true, ref: branchRef("candidate") },
  { consistentRead: true, ref: aliasRef("production") },
  { consistentRead: false, ref: tagRef("release-001") },
  // Existing callers that pass a ReadRef of unknown kind still compile.
  { ref: anyRef },
];
const sortedBody: ListDocsExtendedRequestBody = { sort, consistentRead: true, ref: anyRef };
// @ts-expect-error A Tag List cannot request consistentRead true.
const tagConsistentList: ListDocsInput = { consistentRead: true, ref: tagRef("release-001") };
// @ts-expect-error A ReadRef that may be a Tag cannot request consistentRead true.
const unknownConsistentList: ListDocsInput = { consistentRead: true, ref: anyRef };
// @ts-expect-error Sort directions are "asc" or "desc".
const invalidDirection: ListDocsInput = { sort: [{ category: "ASC" }] };
// @ts-expect-error GET List does not accept sort.
const getSort: ListDocsRequest = { collectionName: "test", sort };
void [sortedLists, sortedBody, tagConsistentList, unknownConsistentList, invalidDirection, getSort];
export async function read(client: LambdaDBClient) {
  const docs = client.collection("test").docs;
  await docs.list(nullable);
  await docs.listSafe(nullable);
  await docs.listAll(nullable);
  for await (const page of docs.listPages(nullable)) void page;
  for await (const page of docs.listPages({ sort, consistentRead: true })) void page;
  await docs.listSafe({ ref: anyRef, sort: null });
  await docs.fetch({ ids: ["one"] });
}
