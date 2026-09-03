import {
  CollectionAliases,
  CollectionBranches,
  CollectionDocs,
  CollectionTags,
  DATA_VERSIONING_CONTRACT_REVISION,
  HTTPClient,
  LambdaDBClient,
  aliasRef,
  branchRef,
  branchSource,
  branchTarget,
  createQueryInput,
  tagRef,
  tagSource,
  tagTarget,
  type AliasTarget,
  type BranchSource,
  type FetchDocsInput,
  type QueryCollectionInput,
  type ReadRef,
  type RefSource,
  type UpsertDocsInput,
  type VersioningError,
} from "../../src/index.js";

const refs: ReadRef[] = [
  branchRef("candidate"),
  tagRef("release-001"),
  aliasRef("production"),
];
const sources: RefSource[] = [
  branchSource("main", new Date()),
  tagSource("release-001"),
];
const targets: AliasTarget[] = [
  branchTarget("candidate"),
  tagTarget("release-001"),
];

const branchQuery: QueryCollectionInput = {
  query: { matchAll: {} },
  ref: branchRef("candidate"),
  consistentRead: true,
};
const tagFetch: FetchDocsInput = {
  ids: ["doc-1"],
  ref: tagRef("release-001"),
  consistentRead: false,
};
const branchWrite: UpsertDocsInput = {
  docs: [{ id: "doc-1" }],
  branch: "candidate",
};
const helperQuery = createQueryInput(
  { matchAll: {} },
  { ref: branchRef("candidate"), consistentRead: true },
);

// @ts-expect-error Tag sources do not support point-in-time asOf.
const invalidTagSource: RefSource = { kind: "tag", name: "release-001", asOf: 1 };
// @ts-expect-error Strong consistency is allowed only for a direct Branch ref.
const invalidAliasQuery: QueryCollectionInput = {
  query: { matchAll: {} },
  ref: aliasRef("production"),
  consistentRead: true,
};
// @ts-expect-error Writes take a Branch name, not a read-ref object.
const invalidWrite: UpsertDocsInput = { docs: [], branch: branchRef("candidate") };
const invalidHelperQuery = createQueryInput(
  { matchAll: {} },
  {
    // @ts-expect-error Query helper also rejects strongly consistent Alias reads.
    ref: aliasRef("production"),
    consistentRead: true,
  },
);

const client = new LambdaDBClient({
  projectApiKey: "test",
  transferClient: new HTTPClient(),
});
const collection = client.collection("collection-name");
const docs: CollectionDocs = collection.docs;
const branches: CollectionBranches = collection.branches;
const tags: CollectionTags = collection.tags;
const aliases: CollectionAliases = collection.aliases;
const revision: string = DATA_VERSIONING_CONTRACT_REVISION;

void refs;
void sources;
void targets;
void branchQuery;
void tagFetch;
void branchWrite;
void helperQuery;
void invalidTagSource;
void invalidAliasQuery;
void invalidWrite;
void invalidHelperQuery;
void docs;
void branches;
void tags;
void aliases;
void revision;
void (null as VersioningError | null);
void (null as BranchSource | null);
