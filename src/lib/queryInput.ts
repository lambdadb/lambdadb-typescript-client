/**
 * Helper to build QueryCollectionInput for collection.query() / collection.querySafe().
 */

import type { FieldsSelectorUnion, PartitionFilter } from "../models/index.js";
import type { QueryCollectionInput } from "../types/public.js";

/**
 * Options for createQueryInput (all optional except query).
 */
export type CreateQueryInputOptions = {
  size?: number;
  consistentRead?: boolean;
  includeVectors?: boolean;
  sort?: Array<{ [k: string]: unknown }>;
  fields?: FieldsSelectorUnion;
  partitionFilter?: PartitionFilter;
};

/**
 * Build a query input object for collection.query() or collection.querySafe().
 * Pass the required query object (e.g. text search or vector search params) and optional options.
 *
 * @example
 * const input = createQueryInput({ text: "hello" }, { size: 10 });
 * const result = await collection.query(input);
 */
export function createQueryInput(
  query: { [k: string]: unknown },
  options?: CreateQueryInputOptions,
): QueryCollectionInput {
  return { query, ...options };
}
