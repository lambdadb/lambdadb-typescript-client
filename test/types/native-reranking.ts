import {
  createQueryInput,
  type CohereRerankConfig,
  type CollectionHandle,
  type QueryCollectionInput,
  type RerankConfig,
  type RerankResponse,
} from "@functional-systems/lambdadb";
import type { RerankConfig as ModelConfig } from "@functional-systems/lambdadb/models";
import type { QueryCollectionRequestBody } from "@functional-systems/lambdadb/models/operations";

const rerank: RerankConfig = {
  provider: "typesafe", model: "jev-1.13.0", queryText: "Restore a version",
  fields: ["title", "body"], candidateSize: null, onFailure: null, criteria: null,
};
const model: ModelConfig = rerank;
const query = { knn: { field: "embedding", queryText: rerank.queryText, k: 50 } };
const input: QueryCollectionInput = { query, rerank, size: 10 };
const body: QueryCollectionRequestBody = input;
const custom = createQueryInput(query, {
  rerank: { ...rerank, onFailure: "returnOriginal", criteria: ["Not useful", "Useful"] },
});
const legacy: QueryCollectionInput = { query, rerank: null };

export async function queryRerank(collection: CollectionHandle): Promise<number | undefined> {
  const response = await collection.query(input);
  const metadata: RerankResponse | undefined = response.rerank;
  const retrievalScore: number | undefined = response.docs[0]?.retrievalScore;
  const safe = await collection.querySafe(custom);
  if (safe.ok && safe.value.rerank?.status === "applied") {
    const criteriaVersion: "default-relevance-v1" | "custom" | "cohere-relevance-v1" | undefined =
      safe.value.rerank.criteriaVersion;
    void criteriaVersion;
  }
  void [body, model, legacy, metadata];
  return retrievalScore;
}
const cohere: CohereRerankConfig = {
  provider: "cohere", model: "rerank-v5.0-fast", queryText: "Restore a version",
  fields: ["body"], candidateSize: 100, onFailure: "returnOriginal", criteria: null,
};
const cohereInput: QueryCollectionInput = { query, rerank: { ...cohere, model: "rerank-v5.0-pro" } };
// @ts-expect-error Providers accept only their own models.
const mismatched: RerankConfig = { ...rerank, provider: "cohere" };
// @ts-expect-error Cohere reranking does not support criteria.
const cohereCriteria: RerankConfig = { ...cohere, criteria: ["Not useful", "Useful"] };
// @ts-expect-error Unsupported providers are not part of the request contract.
const unsupported: RerankConfig = { ...rerank, provider: "voyage" };
// @ts-expect-error Caller weights are unsupported.
const weights: RerankConfig = { ...rerank, weights: [0, 1] };
// @ts-expect-error Structured descriptions are unsupported.
const structured: RerankConfig = { ...rerank, criteria: [{ description: "low" }] };
void [cohereInput, mismatched, cohereCriteria, unsupported, weights, structured];
