import type { BranchDetails, TagDetails, SnapshotDetails, BulkUpsertInput } from "../../src/index.js";
import type { BranchDetails as WireBranchDetails, TagDetails as WireTagDetails } from "../../src/models/index.js";

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

// Facade timestamps are Dates; wire model timestamps remain milliseconds.
const snapshot: SnapshotDetails = { snapshotId: "snap-1", snapshotCommittedAt: new Date() };
const branch: BranchDetails = { name: "candidate", headSnapshot: snapshot, parentSnapshot: null, createdAt: new Date() };
const tag: TagDetails = { name: "release-001", ...snapshot, createdAt: new Date() };
const wireBranch: WireBranchDetails = { name: "main", headSnapshot: null, parentSnapshot: null, createdAt: 1 };
const wireTag: WireTagDetails = { name: "release-001", snapshotId: "snap-1", snapshotCommittedAt: 1, createdAt: 2 };
// @ts-expect-error Branch responses no longer expose a top-level snapshotId.
const obsoleteSnapshotId = branch.snapshotId;
// @ts-expect-error Tag snapshots cannot be null.
const nullTag: TagDetails = { ...tag, snapshotId: null };
// @ts-expect-error Both nullable Branch snapshot fields are required.
const missingParent: BranchDetails = { name: "main", headSnapshot: null, createdAt: new Date() };
// @ts-expect-error Snapshot commit times use Date in the facade.
const numericSnapshot: SnapshotDetails = { snapshotId: "snap-1", snapshotCommittedAt: 1 };

const reads: (QueryCollectionInput | FetchDocsInput)[] = [
  { query: {}, consistentRead: true },
  { ids: [], consistentRead: true },
  { ids: [], ref: branchRef("main"), consistentRead: true },
  { query: {}, ref: aliasRef("production"), consistentRead: false },
  { ids: [], ref: aliasRef("production") },
];
// @ts-expect-error Tag Query cannot request consistentRead true.
const tagQuery: QueryCollectionInput = { query: {}, ref: tagRef("release-001"), consistentRead: true };
// @ts-expect-error Tag Fetch cannot request consistentRead true.
const invalidTagFetch: FetchDocsInput = { ids: [], ref: tagRef("release-001"), consistentRead: true };
// @ts-expect-error Alias Fetch cannot request consistentRead true.
const aliasFetch: FetchDocsInput = { ids: [], ref: aliasRef("production"), consistentRead: true };
const completions: BulkUpsertInput[] = [
  { objectKey: "key" },
  { objectKey: "key", type: "application/json" },
  { objectKey: "key", type: "ignored-metadata" },
];

void [branch, tag, wireBranch, wireTag, obsoleteSnapshotId, nullTag, missingParent, numericSnapshot,
  reads, tagQuery, invalidTagFetch, aliasFetch, completions];
