/**
 * Public API types for the collection-scoped client.
 * Only request-body–level inputs and method return types are exposed.
 */

// ---- Input types (RequestBody / Request aliased as XxxInput) ----
export type { CreateCollectionRequest as CreateCollectionInput } from "../models/operations/createcollection.js";
export type { UpdateCollectionRequestBody as UpdateCollectionInput } from "../models/operations/updatecollection.js";
export type { QueryCollectionRequestBody as QueryCollectionInput } from "../models/operations/querycollection.js";
export type { UpsertDocsRequestBody as UpsertDocsInput } from "../models/operations/upsertdocs.js";
export type { UpdateDocsRequestBody as UpdateDocsInput } from "../models/operations/updatedocs.js";
export type { DeleteDocsRequestBody as DeleteDocsInput } from "../models/operations/deletedocs.js";
export type { FetchDocsRequestBody as FetchDocsInput } from "../models/operations/fetchdocs.js";
export type { BulkUpsertDocsRequestBody as BulkUpsertInput } from "../models/operations/bulkupsertdocs.js";

import type { ListDocsRequest } from "../models/operations/listdocs.js";
import type { ListCollectionsRequest } from "../models/operations/listcollections.js";

/** Parameters for listing documents (size, pageToken). */
export type ListDocsInput = Pick<ListDocsRequest, "size" | "pageToken">;

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
export type {
  FetchDocsResponse,
  FetchDocsDoc,
} from "../models/operations/fetchdocs.js";
export type { GetBulkUpsertDocsResponse } from "../models/operations/getbulkupsertdocs.js";

// ---- Models referenced by request/response bodies ----
export type {
  IndexConfigsUnion,
  PartitionConfig,
  PartitionFilter,
  FieldsSelectorUnion,
  CollectionResponse,
} from "../models/index.js";

// ---- Timestamp helpers (Unix seconds → Date) ----
import type { CollectionResponse as CollectionResponseModel } from "../models/index.js";

/**
 * Collection response with timestamp fields as Date (for better DX).
 * Use {@link collectionResponseWithDates} to convert API response.
 */
export type CollectionResponseWithDates = Omit<
  CollectionResponseModel,
  "createdAt" | "updatedAt" | "dataUpdatedAt"
> & {
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
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
 * Converts Unix-second timestamp fields to Date. Safe to call on partial responses.
 */
export function collectionResponseWithDates(
  c: CollectionResponseModel,
): CollectionResponseWithDates {
  const { createdAt, updatedAt, dataUpdatedAt, ...rest } = c;
  const out: CollectionResponseWithDates = { ...rest };
  if (createdAt != null) out.createdAt = new Date(createdAt * 1000);
  if (updatedAt != null) out.updatedAt = new Date(updatedAt * 1000);
  if (dataUpdatedAt != null)
    out.dataUpdatedAt = new Date(dataUpdatedAt * 1000);
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
