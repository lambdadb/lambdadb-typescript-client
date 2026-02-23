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

/** Parameters for listing documents (size, pageToken). */
export type ListDocsInput = Pick<ListDocsRequest, "size" | "pageToken">;

// ---- Response types ----
export type { ListCollectionsResponse } from "../models/operations/listcollections.js";
export type { CreateCollectionResponse } from "../models/operations/createcollection.js";
export type { GetCollectionResponse } from "../models/operations/getcollection.js";
export type { UpdateCollectionResponse } from "../models/operations/updatecollection.js";
export type {
  QueryCollectionResponse,
  QueryCollectionDoc,
} from "../models/operations/querycollection.js";
export type { ListDocsResponse } from "../models/operations/listdocs.js";
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
