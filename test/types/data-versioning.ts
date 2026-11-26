import type { AliasDetails, BranchDetails, TagDetails, SnapshotDetails, ParentBranchDetails, CreateBranchInput, CreateTagInput, BulkUpsertInput, IndexConfigsUnion, ListRefsInput, UpdateBranchInput, RollbackBranchInput, RollbackBranchResponse } from "../../src/index.js";
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
// Alias reads may request strong consistency; the server resolves the Alias to its Branch.
const aliasQuery: QueryCollectionInput = {
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
const aliasHelperQuery = createQueryInput(
  { matchAll: {} },
  { ref: aliasRef("production"), consistentRead: true },
);
const invalidHelperQuery = createQueryInput(
  { matchAll: {} },
  {
    // @ts-expect-error Query helper rejects strongly consistent Tag reads.
    ref: tagRef("release-001"),
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
void aliasQuery;
void aliasHelperQuery;
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
const parentBranch: ParentBranchDetails = { branchId: "main-id", name: "main" };
const indexConfigs: { [k: string]: IndexConfigsUnion } = { title: { type: "text" } };
const branch: BranchDetails = { name: "candidate", parentBranch, headSnapshot: snapshot, parentSnapshot: null, numDocs: 1, dataUpdatedAt: new Date(), indexConfigs, createdAt: new Date() };
const emptyBranch: BranchDetails = { ...branch, headSnapshot: null, numDocs: 0, dataUpdatedAt: null };
const tag: TagDetails = { name: "release-001", ...snapshot, numDocs: 1, dataUpdatedAt: new Date(), indexConfigs, createdAt: new Date() };
const wireBranch: WireBranchDetails = { name: "main", parentBranch: null, headSnapshot: null, parentSnapshot: null, numDocs: 0, dataUpdatedAt: null, indexConfigs, createdAt: 1 };
const wireTag: WireTagDetails = { name: "release-001", snapshotId: "snap-1", snapshotCommittedAt: 1, numDocs: 1, dataUpdatedAt: 1, indexConfigs, createdAt: 2 };
const alias: AliasDetails = { aliasId: "alias-1", aliasName: "production", targetKind: "TAG", targetName: "release-001", targetId: "tag-1", aliasRevision: 0, dangling: false, indexConfigs, createdAt: new Date() };
const danglingAlias: AliasDetails = { ...alias, dangling: true, indexConfigs: null };
const pendingTag: TagDetails = { ...tag, snapshotId: null, snapshotCommittedAt: null, dataUpdatedAt: null, numDocs: 0 };
const pendingWireTag: WireTagDetails = { ...wireTag, snapshotId: null, snapshotCommittedAt: null, dataUpdatedAt: null, numDocs: 0 };
// @ts-expect-error Branch indexConfigs is never null.
const nullBranchSchema: BranchDetails = { ...branch, indexConfigs: null };
// @ts-expect-error Alias indexConfigs is required, even when its value is null.
const missingAliasSchema: AliasDetails = { aliasId: "alias-1", aliasName: "production", targetKind: "TAG", targetName: "release-001", targetId: "tag-1", aliasRevision: 0, dangling: true, createdAt: new Date() };
void [emptyBranch, alias, danglingAlias, pendingTag, pendingWireTag, nullBranchSchema, missingAliasSchema];
// @ts-expect-error Branch responses no longer expose a top-level snapshotId.
const obsoleteSnapshotId = branch.snapshotId;
// @ts-expect-error Snapshot fields on a Tag are required even before publication.
const incompleteTag: TagDetails = { ...pendingTag, snapshotId: undefined };
// @ts-expect-error parentSnapshot is required, even when its value is null.
const missingParent: BranchDetails = { name: "main", parentBranch: null, headSnapshot: null, numDocs: 0, dataUpdatedAt: null, indexConfigs, createdAt: new Date() };
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
const aliasFetch: FetchDocsInput = { ids: [], ref: aliasRef("production"), consistentRead: true };
const completions: BulkUpsertInput[] = [
  { objectKey: "key" },
  { objectKey: "key", type: "application/json" },
  { objectKey: "key", type: "ignored-metadata" },
];

void [branch, tag, wireBranch, wireTag, obsoleteSnapshotId, incompleteTag, missingParent, numericSnapshot,
  reads, tagQuery, invalidTagFetch, aliasFetch, completions];

// Branch and Tag creation accept the same Branch or Tag sources.
const branchInputs: CreateBranchInput[] = [
  { branchName: "candidate" },
  { branchName: "candidate", source: branchSource("main") },
  { branchName: "candidate", source: branchSource("main", new Date()) },
  { branchName: "candidate", source: branchSource("main", 1788336000000) },
  { branchName: "candidate", source: tagSource("release-001") },
];
const tagInputs: CreateTagInput[] = [
  { tagName: "release-001" },
  { tagName: "release-001", source: branchSource("main", new Date()) },
  { tagName: "release-001", source: tagSource("release-000") },
];
for (const input of branchInputs) {
  void branches.create(input);
  void branches.createSafe(input);
}
for (const input of tagInputs) {
  void tags.create(input);
  void tags.createSafe(input);
}
// @ts-expect-error A Tag source of a Branch does not support asOf.
void branches.create({ branchName: "candidate", source: { kind: "tag", name: "release-001", asOf: 1 } });
// @ts-expect-error An Alias cannot be the source of a Branch.
void branches.create({ branchName: "candidate", source: aliasRef("production") });
// @ts-expect-error An Alias cannot be the source of a Tag.
void tags.createSafe({ tagName: "release-001", source: aliasRef("production") });
// @ts-expect-error parentBranch is required, even when its value is null.
const missingParentBranch: BranchDetails = { name: "main", headSnapshot: null, parentSnapshot: null, numDocs: 0, dataUpdatedAt: null, indexConfigs, createdAt: new Date() };
// @ts-expect-error Parent identity requires both branchId and name.
const incompleteParentBranch: ParentBranchDetails = { name: "main" };
void [missingParentBranch, incompleteParentBranch];

// Single reads, Branch schema updates and rollbacks, and paginated listings.
async function refOperations(): Promise<void> {
  const page: ListRefsInput = { size: 100, pageToken: "token" };
  const update: UpdateBranchInput = { indexConfigs };
  const rollback: RollbackBranchInput = { tag: "release-001" };

  const got: BranchDetails = (await branches.get("candidate")).branch;
  const updated: BranchDetails = (await branches.update("candidate", update)).branch;
  const gotTag: TagDetails = (await tags.get("release-001")).tag;
  const gotAlias: AliasDetails = (await aliases.get("production")).alias;
  const schema: { [k: string]: IndexConfigsUnion } | null = gotAlias.indexConfigs;
  const safeUpdate = await branches.updateSafe("candidate", update);
  if (safeUpdate.ok) void safeUpdate.value.branch.dataUpdatedAt?.getTime();
  const rolledBack: RollbackBranchResponse = await branches.rollback("candidate", rollback);
  const safeRollback = await branches.rollbackSafe("candidate", rollback);
  const rollbackTime: Date | null = rolledBack.headSnapshot?.snapshotCommittedAt ?? null;
  if (safeRollback.ok) void safeRollback.value.headSnapshot?.snapshotCommittedAt.getTime();
  const tagCommitTime: Date | null = gotTag.snapshotCommittedAt;
  // @ts-expect-error A rollback to a Tag without a published snapshot returns a null head.
  const uncheckedRollbackTime: Date = rolledBack.headSnapshot.snapshotCommittedAt;
  void [rollbackTime, tagCommitTime, uncheckedRollbackTime];
  const emptyHeadRollback: RollbackBranchResponse = { branchId: "branch-id", headSnapshot: null };
  // @ts-expect-error headSnapshot is required, even when its value is null.
  const incompleteRollback: RollbackBranchResponse = { branchId: "branch-id" };
  // @ts-expect-error A rollback requires the Tag name.
  void branches.rollback("candidate", {});
  void [emptyHeadRollback, incompleteRollback];

  const branchPage = await branches.listPage(page);
  const tagPage = await tags.listPage({ size: 1 }, { timeoutMs: 1000 });
  const aliasPage = await aliases.listPageSafe();
  const tokens: (string | undefined)[] = [branchPage.nextPageToken, tagPage.nextPageToken];
  if (aliasPage.ok) tokens.push(aliasPage.value.nextPageToken);
  for await (const each of branches.listPages(page)) void each.branches;

  // list keeps its pre-pagination signature and returns every entry.
  const allBranches: BranchDetails[] = (await branches.list()).branches;
  const allTags: TagDetails[] = (await tags.list({ timeoutMs: 1000 })).tags;
  const safeAliases = await aliases.listSafe({ retries: { strategy: "none" } });
  const allAliases: AliasDetails[] = safeAliases.ok ? safeAliases.value.aliases : [];
  // @ts-expect-error The complete listing has no nextPageToken.
  void (await branches.list()).nextPageToken;
  // @ts-expect-error Pagination parameters belong to listPage, not list.
  void tags.list({ size: 10 });
  // @ts-expect-error list takes request options only.
  void aliases.list(undefined, { timeoutMs: 1000 });
  // @ts-expect-error listAll does not exist; list is the complete listing.
  void branches.listAll();

  // @ts-expect-error A Branch update carries indexConfigs only.
  void branches.update("candidate", { indexConfigs, description: "no" });
  // @ts-expect-error A Branch update requires indexConfigs.
  void branches.update("candidate", {});
  // @ts-expect-error Request options are the second argument of listPage.
  void branches.listPage({ timeoutMs: 1000 });
  // @ts-expect-error Listing page tokens are strings; null is not accepted.
  void tags.listPage({ pageToken: null });
  void [got, updated, gotTag, schema, tokens, allBranches, allTags, allAliases];
}
void refOperations;

// Collection create returns the full Collection shape.
async function createdCollectionShape(): Promise<void> {
  const { collection: created } = await client.createCollection({ collectionName: "items", indexConfigs });
  const schema: { [k: string]: IndexConfigsUnion } = created.indexConfigs;
  const dates: (Date | undefined)[] = [created.createdAt, created.updatedAt, created.dataUpdatedAt];
  const counts: number[] = [created.numDocs, created.numPartitions];
  void [schema, dates, counts, created.projectName];
}
void createdCollectionShape;
