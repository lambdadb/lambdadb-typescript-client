import { createQueryInput, type BayesianQuery, type BayesianSubquery, type CollectionHandle } from "@functional-systems/lambdadb";
import type { BayesianQuery as ModelQuery } from "@functional-systems/lambdadb/models";

const lexical: BayesianSubquery = { bool: [{ queryString: { query: "body:restore" } }] };
const vector: BayesianSubquery = { knn: { field: "embedding", queryVector: [1, 0], k: 30 } };
const query: BayesianQuery = { bayesian: [lexical, vector] };
const modelQuery: ModelQuery = query;

export async function search(collection: CollectionHandle) {
  await collection.query(createQueryInput(query, { candidateSize: 30 }));
  return collection.querySafe({ query, rerank: {
    provider: "typesafe", model: "jev-1.13.0", queryText: "Restore a version", fields: ["body"],
  } });
}

// @ts-expect-error Exactly two signals are required.
const one: BayesianQuery = { bayesian: [lexical] };
// @ts-expect-error More than two signals are unsupported.
const three: BayesianQuery = { bayesian: [lexical, vector, lexical] };
// @ts-expect-error Explicit boosts, even 1, are unsupported on a child.
const boosted: BayesianSubquery = { ...vector, boost: 1 };
// @ts-expect-error Explicit boosts are also unsupported on Boolean descendants.
const descendant: BayesianSubquery = { bool: [{ bool: [{ ...lexical, boost: 1 }] }] };
// @ts-expect-error Bayesian fusion is allowed only at the top level.
const nested: BayesianQuery = { bayesian: [{ bayesian: [lexical, vector] }, lexical] };
// @ts-expect-error Bayesian fusion is also unsupported beneath Boolean descendants.
const nestedDescendant: BayesianSubquery = { bool: [{ bool: [{ bayesian: [lexical, vector] }] }] };
// @ts-expect-error RRF fusion also requires top-level placement.
const nestedRrf: BayesianSubquery = { rrf: [lexical, vector] };
// @ts-expect-error Min-Max fusion also requires top-level placement.
const nestedMm: BayesianSubquery = { mm: [lexical, vector] };
// @ts-expect-error L2 fusion also requires top-level placement.
const nestedL2: BayesianSubquery = { l2: [lexical, vector] };
// @ts-expect-error RRF fusion is unsupported beneath Boolean descendants.
const descendantRrf: BayesianSubquery = { bool: [{ bool: [{ rrf: [lexical, vector] }] }] };
// @ts-expect-error Min-Max fusion is unsupported beneath Boolean descendants.
const descendantMm: BayesianSubquery = { bool: [{ bool: [{ mm: [lexical, vector] }] }] };
// @ts-expect-error L2 fusion is unsupported beneath Boolean descendants.
const descendantL2: BayesianSubquery = { bool: [{ bool: [{ l2: [lexical, vector] }] }] };
void [modelQuery, one, three, boosted, descendant, nested, nestedDescendant,
  nestedRrf, nestedMm, nestedL2, descendantRrf, descendantMm, descendantL2];
