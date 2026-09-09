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
  BadGatewayError,
  CatalogConflictError,
  GatewayTimeoutError,
  UnauthenticatedError,
  PayloadTooLargeError,
  ResourceNotFoundError,
  ResourceAlreadyExistsError,
  ServiceUnavailableError,
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

/** Transport errors handled by the shared Gateway response matcher. */
type GatewayResponseError =
  | errors.PayloadTooLargeError
  | errors.BadGatewayError
  | errors.ServiceUnavailableError
  | errors.GatewayTimeoutError;

/** Errors that can occur when listing or getting collections. */
export type ListCollectionsError =
  | errors.UnauthenticatedError
  | errors.ResourceNotFoundError
  | errors.TooManyRequestsError
  | errors.InternalServerError
  | GatewayResponseError
  | LambdaDBClientError;

/** Errors that can occur when creating a collection. */
export type CreateCollectionError =
  | errors.BadRequestError
  | errors.UnauthenticatedError
  | errors.ResourceAlreadyExistsError
  | errors.TooManyRequestsError
  | errors.InternalServerError
  | GatewayResponseError
  | LambdaDBClientError;

/** Errors that can occur when getting a collection. */
export type GetCollectionError = ListCollectionsError;

/** Errors that can occur when updating a collection. */
export type UpdateCollectionError =
  | errors.CatalogConflictError
  | QueryCollectionError;

/** Errors that can occur when deleting a collection. */
export type DeleteCollectionError =
  | errors.CatalogConflictError
  | ListCollectionsError;

/** Errors that can occur when querying a collection. */
export type QueryCollectionError =
  | errors.BadRequestError
  | errors.UnauthenticatedError
  | errors.ResourceNotFoundError
  | errors.TooManyRequestsError
  | errors.InternalServerError
  | GatewayResponseError
  | LambdaDBClientError;

/** Errors that can occur when listing, upserting, updating, deleting, or fetching docs, or when calling bulkUpsert. */
export type ListDocsError = QueryCollectionError;
export type UpsertDocsError = QueryCollectionError;
export type UpdateDocsError = QueryCollectionError;
export type DeleteDocsError = QueryCollectionError;
export type FetchDocsError = QueryCollectionError;
export type BulkUpsertDocsError = QueryCollectionError;

/** Errors that can occur when getting bulk upsert docs info. */
export type GetBulkUpsertDocsError =
  | errors.BadRequestError
  | ListCollectionsError;
