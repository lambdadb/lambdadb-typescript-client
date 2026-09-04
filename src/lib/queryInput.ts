/**
 * Helper to build QueryCollectionInput for collection.query() / collection.querySafe().
 */

import type { QueryCollectionInput } from "../types/public.js";

/**
 * Options for createQueryInput (all optional except query).
 */
type WithoutQuery<T> = T extends unknown ? Omit<T, "query"> : never;
export type CreateQueryInputOptions = WithoutQuery<QueryCollectionInput>;

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
  return { query, ...options } as QueryCollectionInput;
}
