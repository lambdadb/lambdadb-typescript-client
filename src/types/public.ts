/**
 * Public API types for the collection-scoped client.
 * Only request-body–level inputs and method return types are exposed.
 */

// ---- Input types (RequestBody / Request aliased as XxxInput) ----
export type { BayesianQuery, BayesianSubquery } from "../models/bayesian.js";
export type { CreateCollectionRequest as CreateCollectionInput } from "../models/operations/createcollection.js";
export type { UpdateCollectionRequestBody as UpdateCollectionInput } from "../models/operations/updatecollection.js";
export type { UpsertDocsRequestBody as UpsertDocsInput } from "../models/operations/upsertdocs.js";
export type { UpdateDocsRequestBody as UpdateDocsInput } from "../models/operations/updatedocs.js";
export type { DeleteDocsRequestBody as DeleteDocsInput } from "../models/operations/deletedocs.js";
export type { BulkUpsertDocsRequestBody as BulkUpsertInput } from "../models/operations/bulkupsertdocs.js";

import type { ListDocsExtendedRequestBody } from "../models/operations/listdocs.js";
import type { ListCollectionsRequest } from "../models/operations/listcollections.js";
import type { QueryCollectionRequestBody } from "../models/operations/querycollection.js";
import type { FetchDocsRequestBody } from "../models/operations/fetchdocs.js";
import type {
  AliasDetails as AliasDetailsModel,
  AliasRef,
  BranchRef,
  ReadRef,
  BranchDetails as BranchDetailsModel,
  SnapshotDetails as SnapshotDetailsModel,
  TagDetails as TagDetailsModel,
  TagRef,
} from "../models/versioning.js";

/**
 * Consistent reads need a Branch, an Alias that currently targets a Branch, or
 * an omitted ref (implicit main). The server resolves the Alias when the request
 * is admitted and rejects an Alias that targets a Tag with HTTP 400. Tag reads
 * cannot request consistentRead true.
 */
type ConsistentReadForRef =
  | { ref?: BranchRef | AliasRef | undefined; consistentRead?: boolean | undefined }
  | { ref: TagRef; consistentRead?: false | undefined };

/** Query input; consistent reads are limited to Branch and Alias refs. */
export type QueryCollectionInput = Omit<
  QueryCollectionRequestBody,
  "ref" | "consistentRead"
> & ConsistentReadForRef;

/** Fetch input; consistent reads are limited to Branch and Alias refs. */
export type FetchDocsInput = Omit<
  FetchDocsRequestBody,
  "ref" | "consistentRead"
> & ConsistentReadForRef;

/** Parameters for listing documents, including extended list options. */
export type ListDocsInput = Pick<
  ListDocsExtendedRequestBody,
  "size" | "pageToken" | "includeVectors"
> & {
  filter?: Record<string, unknown> | null | undefined;
  partitionFilter?: import("../models/index.js").PartitionFilter | undefined;
  fields?: import("../models/index.js").FieldsSelectorUnion | undefined;
  /** Read target. Omitting it reads from main. */
  ref?: ReadRef | undefined;
};

/** Parameters for listing collections (size, pageToken). */
export type ListCollectionsInput = Pick<
  ListCollectionsRequest,
  "size" | "pageToken"
>;

// ---- Response types ----
export type { ListCollectionsResponse } from "../models/operations/listcollections.js";
export type { CreateCollectionResponse } from "../models/operations/createcollection.js";
export type { GetCollectionResponse } from "../models/operations/getcollection.js";
export type { UpdateCollectionResponse } from "../models/operations/updatecollection.js";
export type {
  QueryCollectionResponse,
  QueryCollectionDoc,
} from "../models/operations/querycollection.js";
export type {
  ListDocsResponse,
  ListDocsDoc,
} from "../models/operations/listdocs.js";
export type { MessageResponse } from "../models/index.js";
export type { FetchDocsResponse, FetchDocsDoc } from "../models/operations/fetchdocs.js";
export type { GetBulkUpsertDocsResponse } from "../models/operations/getbulkupsertdocs.js";

export type {
  AliasRef,
  AliasTarget,
  BranchRef,
  BranchSource,
  ParentBranchDetails,
  ReadRef,
  RefSource,
  TagRef,
  TagSource,
} from "../models/versioning.js";

export type SnapshotDetails = Omit<SnapshotDetailsModel, "snapshotCommittedAt"> & {
  snapshotCommittedAt: Date;
};

export type BranchDetails = Omit<
  BranchDetailsModel,
  "createdAt" | "dataUpdatedAt" | "headSnapshot" | "parentSnapshot"
> & {
  headSnapshot: SnapshotDetails | null;
  parentSnapshot: SnapshotDetails | null;
  /** Last data update of the committed head; null for an empty Branch. */
  dataUpdatedAt: Date | null;
  createdAt: Date;
};

export type TagDetails = Omit<
  TagDetailsModel,
  "createdAt" | "dataUpdatedAt" | "snapshotCommittedAt"
> & {
  /** Commit time of the published snapshot, or null before publication. */
  snapshotCommittedAt: Date | null;
  /** Last data update of the published snapshot, or null before publication. */
  dataUpdatedAt: Date | null;
  createdAt: Date;
};

export type AliasDetails = Omit<AliasDetailsModel, "createdAt"> & {
  createdAt: Date;
};

/**
 * Pagination parameters of `listPage` and `listPages` on Branches, Tags, and
 * Aliases. Omitted values are not sent; the server then returns the first page
 * of 10 entries.
 */
export type ListRefsInput = {
  /** Max number of entries to return at once, from 1 through 100. */
  size?: number | undefined;
  /**
   * Opaque token from the previous page's `nextPageToken`. Omit it for the
   * first page; an empty string is treated as omitted and is not sent.
   */
  pageToken?: string | undefined;
};

export type CreateBranchInput = {
  branchName: string;
  /**
   * Omit to use main. A Tag source creates the Branch from the Tag's pinned
   * state; `asOf` is valid only for a Branch source.
   */
  source?: import("../models/versioning.js").RefSource | undefined;
};

/** A Branch owns only its index schema; other settings stay on the Collection. */
export type UpdateBranchInput = {
  /**
   * The Branch's complete existing schema plus any new fields. Must contain at
   * least one field.
   */
  indexConfigs: { [k: string]: import("../models/index.js").IndexConfigsUnion };
};

export type CreateBranchResponse = { branch: BranchDetails };
export type GetBranchResponse = { branch: BranchDetails };
export type UpdateBranchResponse = { branch: BranchDetails };

export type RollbackBranchInput = {
  /** Name of a Tag in this Collection with a published snapshot. */
  tag: string;
};

export type RollbackBranchResponse = {
  branchId: string;
  /** The new snapshot committed on the destination Branch. */
  headSnapshot: SnapshotDetails;
};

/** Every Branch of the Collection. */
export type ListBranchesResponse = { branches: BranchDetails[] };
export type ListBranchesPageResponse = {
  branches: BranchDetails[];
  /** Opaque token for the next page. Absent on the last page. */
  nextPageToken?: string | undefined;
};

export type CreateTagInput = {
  tagName: string;
  source?: import("../models/versioning.js").RefSource | undefined;
};

export type CreateTagResponse = { tag: TagDetails };
export type GetTagResponse = { tag: TagDetails };
/** Every Tag of the Collection. */
export type ListTagsResponse = { tags: TagDetails[] };
export type ListTagsPageResponse = {
  tags: TagDetails[];
  /** Opaque token for the next page. Absent on the last page. */
  nextPageToken?: string | undefined;
};

export type CreateAliasInput = {
  aliasName: string;
  target: import("../models/versioning.js").AliasTarget;
};

export type RetargetAliasInput = {
  target: import("../models/versioning.js").AliasTarget;
};

export type AliasResponse = { alias: AliasDetails };
/** Every Alias of the Collection. */
export type ListAliasesResponse = { aliases: AliasDetails[] };
export type ListAliasesPageResponse = {
  aliases: AliasDetails[];
  /** Opaque token for the next page. Absent on the last page. */
  nextPageToken?: string | undefined;
};
export type GetBulkUpsertInput = { branch?: string | undefined };

// ---- Models referenced by request/response bodies ----
export type {
  FieldDescription,
  IndexConfigsUnion,
  IndexConfigsManagedEmbeddingVector,
  IndexConfigsNativeEmbeddingVector,
  EmbeddingConfig,
  EmbeddingProvider,
  EmbeddingSource,
  PartitionConfig,
  PartitionFilter,
  FieldsSelectorUnion,
  CollectionResponse,
} from "../models/index.js";

// ---- Timestamp helpers (Unix epoch milliseconds → Date) ----
import type { CollectionResponse as CollectionResponseModel } from "../models/index.js";

/**
 * Collection response with timestamp fields as Date (for better DX).
 * Use {@link collectionResponseWithDates} to convert API response.
 */
export type CollectionResponseWithDates = Omit<
  CollectionResponseModel,
  "createdAt" | "updatedAt" | "dataUpdatedAt"
> & {
  createdAt: Date;
  updatedAt: Date;
  dataUpdatedAt?: Date | undefined;
};

/**
 * List collections response with timestamp fields as Date.
 */
export type ListCollectionsResponseWithDates = {
  collections: CollectionResponseWithDates[];
  nextPageToken?: string | undefined;
};

/**
 * Converts Unix-millisecond timestamp fields to Date. Safe to call on partial responses.
 */
export function collectionResponseWithDates(
  c: CollectionResponseModel,
): CollectionResponseWithDates {
  const { createdAt, updatedAt, dataUpdatedAt, ...rest } = c;
  const out: CollectionResponseWithDates = {
    ...rest,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  };
  if (dataUpdatedAt != null)
    out.dataUpdatedAt = new Date(dataUpdatedAt);
  return out;
}

/** Converts ListCollectionsResponse to use Date for timestamp fields. */
export function listCollectionsResponseWithDates(res: {
  collections: CollectionResponseModel[];
  nextPageToken?: string | undefined;
}): ListCollectionsResponseWithDates {
  const out: ListCollectionsResponseWithDates = {
    collections: res.collections.map(collectionResponseWithDates),
  };
  if (res.nextPageToken !== undefined) out.nextPageToken = res.nextPageToken;
  return out;
}

/** Get collection response with timestamp fields as Date. */
export type GetCollectionResponseWithDates = {
  collection: CollectionResponseWithDates;
};

/** Converts GetCollectionResponse to use Date for timestamp fields. */
export function getCollectionResponseWithDates(res: {
  collection: CollectionResponseModel;
}): GetCollectionResponseWithDates {
  return { collection: collectionResponseWithDates(res.collection) };
}

/** Update response with timestamp fields converted to Date. */
export type UpdateCollectionResponseWithDates = GetCollectionResponseWithDates;

export function updateCollectionResponseWithDates(res: {
  collection: CollectionResponseModel;
}): UpdateCollectionResponseWithDates {
  return getCollectionResponseWithDates(res);
}

/**
 * Create response with timestamp fields converted to Date. The created
 * Collection has the same shape as a Collection read.
 */
export type CreateCollectionResponseWithDates = GetCollectionResponseWithDates;

export function createCollectionResponseWithDates(res: {
  collection: CollectionResponseModel;
}): CreateCollectionResponseWithDates {
  return getCollectionResponseWithDates(res);
}

/** @internal */
export function snapshotDetailsWithDate(details: SnapshotDetailsModel): SnapshotDetails {
  return { ...details, snapshotCommittedAt: new Date(details.snapshotCommittedAt) };
}

/** @internal */
export function branchDetailsWithDates(details: BranchDetailsModel): BranchDetails {
  return {
    ...details,
    headSnapshot: details.headSnapshot === null ? null : snapshotDetailsWithDate(details.headSnapshot),
    parentSnapshot: details.parentSnapshot === null ? null : snapshotDetailsWithDate(details.parentSnapshot),
    dataUpdatedAt: details.dataUpdatedAt === null ? null : new Date(details.dataUpdatedAt),
    createdAt: new Date(details.createdAt),
  };
}

/** @internal */
export function tagDetailsWithDates(details: TagDetailsModel): TagDetails {
  return {
    ...details,
    snapshotCommittedAt: details.snapshotCommittedAt === null
      ? null
      : new Date(details.snapshotCommittedAt),
    dataUpdatedAt: details.dataUpdatedAt === null ? null : new Date(details.dataUpdatedAt),
    createdAt: new Date(details.createdAt),
  };
}

/** @internal */
export function aliasDetailsWithDate(details: AliasDetailsModel): AliasDetails {
  return { ...details, createdAt: new Date(details.createdAt) };
}

export type { FacetRequest, FacetBucket, FacetResult } from "../models/operations/querycollection.js";

export type { RerankConfig, TypesafeRerankConfig, CohereRerankConfig, RerankResponse } from "../models/rerank.js";
