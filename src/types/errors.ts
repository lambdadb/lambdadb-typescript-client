/**
 * Public API error types for the collection-scoped client.
 * Re-exports error classes and defines per-operation error unions for Safe methods.
 */

import type * as errors from "../models/errors/index.js";
import type { LambdaDBError } from "../models/errors/lambdadberror.js";
import type { ResponseValidationError } from "../models/errors/responsevalidationerror.js";
import type { SDKValidationError } from "../models/errors/sdkvalidationerror.js";
import type {
  ConnectionError,
  RequestAbortedError,
  RequestTimeoutError,
  InvalidRequestError,
  UnexpectedClientError,
} from "../models/errors/httpclienterrors.js";

// ---- Re-export error classes for instanceof checks and typing ----
export {
  BadRequestError,
  UnauthenticatedError,
  ResourceNotFoundError,
  ResourceAlreadyExistsError,
  TooManyRequestsError,
  InternalServerError,
  LambdaDBError,
  LambdaDBDefaultError,
  ResponseValidationError,
  SDKValidationError,
} from "../models/errors/index.js";
export {
  HTTPClientError,
  ConnectionError,
  RequestAbortedError,
  RequestTimeoutError,
  InvalidRequestError,
  UnexpectedClientError,
} from "../models/errors/httpclienterrors.js";

// ---- Base union: errors common to all operations (client/SDK layer) ----
export type LambdaDBClientError =
  | LambdaDBError
  | ResponseValidationError
  | ConnectionError
  | RequestAbortedError
  | RequestTimeoutError
  | InvalidRequestError
  | UnexpectedClientError
  | SDKValidationError;

// ---- API error unions (subset of errors.* per operation) ----

/** Errors that can occur when listing collections, getting a collection, deleting a collection, or getting bulk upsert info. */
export type ListCollectionsError =
  | errors.UnauthenticatedError
  | errors.ResourceNotFoundError
  | errors.TooManyRequestsError
  | errors.InternalServerError
  | LambdaDBClientError;

/** Errors that can occur when creating a collection. */
export type CreateCollectionError =
  | errors.BadRequestError
  | errors.UnauthenticatedError
  | errors.ResourceAlreadyExistsError
  | errors.TooManyRequestsError
  | errors.InternalServerError
  | LambdaDBClientError;

/** Errors that can occur when getting a collection. */
export type GetCollectionError = ListCollectionsError;

/** Errors that can occur when updating a collection. */
export type UpdateCollectionError =
  | errors.BadRequestError
  | errors.UnauthenticatedError
  | errors.ResourceNotFoundError
  | errors.TooManyRequestsError
  | errors.InternalServerError
  | LambdaDBClientError;

/** Errors that can occur when deleting a collection. */
export type DeleteCollectionError = ListCollectionsError;

/** Errors that can occur when querying a collection. */
export type QueryCollectionError = UpdateCollectionError;

/** Errors that can occur when listing, upserting, updating, deleting, or fetching docs, or when calling bulkUpsert. */
export type ListDocsError = UpdateCollectionError;
export type UpsertDocsError = UpdateCollectionError;
export type UpdateDocsError = UpdateCollectionError;
export type DeleteDocsError = UpdateCollectionError;
export type FetchDocsError = UpdateCollectionError;
export type BulkUpsertDocsError = UpdateCollectionError;

/** Errors that can occur when getting bulk upsert docs info. */
export type GetBulkUpsertDocsError = ListCollectionsError;
