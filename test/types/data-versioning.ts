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
  type DeleteDocsInput,
  type FetchDocsInput,
  type QueryCollectionInput,
  type ReadRef,
  type RefSource,
  type UpsertDocsInput,
  type UpdateCollectionInput,
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
const deleteByIds: DeleteDocsInput = { ids: ["doc-1"], branch: "candidate" };
const deleteByFilter: DeleteDocsInput = {
  filter: { queryString: { query: "kind:test" } },
  partitionFilter: { field: "tenant", in: ["acme"] },
};
const patchWithNullNoOps: UpdateCollectionInput = {
  description: null,
  tags: {},
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
// @ts-expect-error Delete requires exactly one of ids or filter.
const invalidDeleteBoth: DeleteDocsInput = { ids: ["doc-1"], filter: {} };
// @ts-expect-error partitionFilter cannot be the only delete selector.
const invalidDeletePartitionOnly: DeleteDocsInput = {
  partitionFilter: { field: "tenant", in: ["acme"] },
};
// @ts-expect-error Collection PATCH requires at least one non-null field.
const invalidNullOnlyPatch: UpdateCollectionInput = { description: null };
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
void deleteByIds;
void deleteByFilter;
void patchWithNullNoOps;
void helperQuery;
void invalidTagSource;
void invalidAliasQuery;
void invalidWrite;
void invalidDeleteBoth;
void invalidDeletePartitionOnly;
void invalidNullOnlyPatch;
void invalidHelperQuery;
void docs;
void branches;
void tags;
void aliases;
void revision;
void (null as VersioningError | null);
void (null as BranchSource | null);
