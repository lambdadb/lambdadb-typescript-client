/*
 * Maintained manually following docs/OPENAPI_UPDATE.md.
 */

import * as z from "zod/v3";
import { remap as remap$ } from "../../lib/primitives.js";
import { nullToUndefined, safeParse } from "../../lib/schemas.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
import * as models from "../index.js";
import { hasRerankScoringQuery } from "../rerank.js";

export type FacetRequest = {
  /** Maximum buckets to return (1–100). Omitted or null uses the server default of 10. */
  size?: number | null | undefined;
};
export type FacetBucket = { value: string; count: number };
export type FacetResult = { buckets: Array<FacetBucket> };

export type QueryCollectionRequestBody = {
  /**
   * Number of documents to return. Note that the maximum number of documents is 100.
   */
  size?: number | undefined;
  /**
   * Query object. For managed embedding vector fields, use knn.queryText. For unmanaged vector fields, use knn.queryVector.
   */
  query?: { [k: string]: any } | undefined;
  facets?: Record<string, FacetRequest> | undefined;
  /** Optional per-query managed reranking. Omitted or null preserves retrieval behavior. */
  rerank?: models.RerankConfig | null | undefined;
  /**
   * Overlay eligible pending writes on a directly selected Branch. Tag and Alias reads reject true, pending bulk imports are excluded, and an oversized pending overlay can return HTTP 429.
   */
  consistentRead?: boolean | undefined;
  /**
   * If your application need to include vector values in the response, set includeVectors to true.
   */
  includeVectors?: boolean | undefined;
  /**
   * List of field name, sort direction pairs.
   */
  sort?: Array<{ [k: string]: any }> | undefined;
  /**
   * An object to specify a list of field names to include and/or exclude in the result.
   */
  fields?: models.FieldsSelectorUnion | undefined;
  partitionFilter?: models.PartitionFilter | undefined;
  /** Read target. Omitting it reads from main. */
  ref?: models.ReadRef | undefined;
};

export type QueryCollectionRequest = {
  /**
   * Collection name.
   */
  collectionName: string;
  requestBody: QueryCollectionRequestBody;
};

export type QueryCollectionDoc = {
  /**
   * Collection name.
   */
  collection: string;
  /**
   * Final ranking score: evaluation score in [0,1] when rerank is applied, otherwise retrieval score.
   */
  score?: number | undefined;
  /** Original retrieval/fusion score, outside doc; present only when rerank is applied. */
  retrievalScore?: number | undefined;
  doc: { [k: string]: any };
};

/**
 * Documents selected by query.
 */
export type QueryCollectionResponse = {
  /** Present only for requests using reranking. */
  rerank?: models.RerankResponse | undefined;
  facets?: Record<string, FacetResult> | undefined;
  /**
   * Elapsed time in milliseconds.
   */
  took: number;
  /**
   * Maximum final returned score, including zero; omitted for empty rerank results.
   */
  maxScore?: number | undefined;
  /**
   * Total number of documents returned.
   */
  total: number;
  /**
   * List of documents.
   */
  docs: Array<QueryCollectionDoc>;
  /**
   * Whether the list of documents is included.
   */
  isDocsInline: boolean;
  /**
   * Optional download URL for the list of documents.
   */
  docsUrl?: string | undefined;
};

/** @internal */
export type QueryCollectionRequestBody$Outbound = {
  size?: number | undefined;
  query?: { [k: string]: any } | undefined;
  facets?: Record<string, FacetRequest> | undefined;
  /** Optional per-query managed reranking. Omitted or null preserves retrieval behavior. */
  rerank?: models.RerankConfig | null | undefined;
  consistentRead: boolean;
  includeVectors: boolean;
  sort?: Array<{ [k: string]: any }> | undefined;
  fields?: models.FieldsSelectorUnion$Outbound | undefined;
  partitionFilter?: models.PartitionFilter$Outbound | undefined;
  ref?: models.ReadRef | undefined;
};

/** @internal */
export const QueryCollectionRequestBody$outboundSchema: z.ZodType<
  QueryCollectionRequestBody$Outbound,
  z.ZodTypeDef,
  QueryCollectionRequestBody
> = z.object({
  size: z.number().int().optional(),
  query: z.record(z.any()).optional(),
  facets: z.record(z.object({
    size: z.number().int().min(1).max(100).nullable().optional(),
  }).strict()).refine((facets) => Object.keys(facets).length <= 5, {
    message: "At most five facet fields may be requested",
  }).optional(),
  rerank: models.RerankConfig$outboundSchema.nullable().optional(),
  consistentRead: z.boolean().default(false),
  includeVectors: z.boolean().default(false),
  sort: z.array(z.record(z.any())).optional(),
  fields: models.FieldsSelectorUnion$outboundSchema.optional(),
  partitionFilter: models.PartitionFilter$outboundSchema.optional(),
  ref: models.ReadRef$schema.optional(),
}).strict().superRefine((value, context) => {
  if (value.rerank != null) {
    const size = value.size ?? 10;
    const candidateSize = value.rerank.candidateSize ?? Math.max(50, size);
    if (size < 1 || size > 100 || candidateSize < size) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rerank requires 1 <= size <= candidateSize <= 100",
        path: ["rerank", "candidateSize"],
      });
    }
    if (value.sort !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rerank cannot be combined with sort",
        path: ["sort"],
      });
    }
    if (!hasRerankScoringQuery(value.query)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rerank requires a scoring retrieval query",
        path: ["query"],
      });
    }
  }
  if (value.size === 0 && Object.keys(value.facets ?? {}).length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "size: 0 requires at least one facet",
      path: ["facets"],
    });
  }
  if (value.consistentRead && value.ref != null && value.ref.kind !== "branch") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "consistentRead is supported only for direct Branch reads",
      path: ["consistentRead"],
    });
  }
});

export function queryCollectionRequestBodyToJSON(
  queryCollectionRequestBody: QueryCollectionRequestBody,
): string {
  return JSON.stringify(
    QueryCollectionRequestBody$outboundSchema.parse(queryCollectionRequestBody),
  );
}

/** @internal */
export type QueryCollectionRequest$Outbound = {
  collectionName: string;
  RequestBody: QueryCollectionRequestBody$Outbound;
};

/** @internal */
export const QueryCollectionRequest$outboundSchema: z.ZodType<
  QueryCollectionRequest$Outbound,
  z.ZodTypeDef,
  QueryCollectionRequest
> = z.object({
  collectionName: z.string(),
  requestBody: z.lazy(() => QueryCollectionRequestBody$outboundSchema),
}).transform((v) => {
  return remap$(v, {
    requestBody: "RequestBody",
  });
});

export function queryCollectionRequestToJSON(
  queryCollectionRequest: QueryCollectionRequest,
): string {
  return JSON.stringify(
    QueryCollectionRequest$outboundSchema.parse(queryCollectionRequest),
  );
}

/** @internal */
export const QueryCollectionDoc$inboundSchema: z.ZodType<
  QueryCollectionDoc,
  z.ZodTypeDef,
  unknown
> = z.object({
  collection: z.string(),
  score: nullToUndefined(z.number().optional()),
  retrievalScore: nullToUndefined(z.number().optional()),
  doc: z.record(z.any()),
});

export function queryCollectionDocFromJSON(
  jsonString: string,
): SafeParseResult<QueryCollectionDoc, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => QueryCollectionDoc$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'QueryCollectionDoc' from JSON`,
  );
}

/** @internal */
export const QueryCollectionResponse$inboundSchema: z.ZodType<
  QueryCollectionResponse,
  z.ZodTypeDef,
  unknown
> = z.object({
  rerank: nullToUndefined(models.RerankResponse$inboundSchema.optional()),
  took: z.number().int(),
  maxScore: nullToUndefined(z.number().optional()),
  total: z.number().int(),
  docs: z.array(z.lazy(() => QueryCollectionDoc$inboundSchema)),
  isDocsInline: z.boolean(),
  docsUrl: nullToUndefined(z.string().optional()),
  facets: nullToUndefined(z.record(z.object({
    buckets: z.array(z.object({ value: z.string(), count: z.number().int() })),
  })).optional()),
});

export function queryCollectionResponseFromJSON(
  jsonString: string,
): SafeParseResult<QueryCollectionResponse, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => QueryCollectionResponse$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'QueryCollectionResponse' from JSON`,
  );
}
