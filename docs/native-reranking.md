# Native reranking

Select native reranking per query through `collection.query()` or `querySafe()`.
The server manages provider credentials; supply only your LambdaDB project API
key. There is no collection-level rerank setting or client-side reranking step.
Omitted or null `rerank` preserves existing search behavior.

The implementation contract is pinned to backend commit
[`ff13daf3f4ed40487b2b13522a141265c2f459ab`](https://github.com/lambdadb/lambdadb/tree/ff13daf3f4ed40487b2b13522a141265c2f459ab),
including [RerankConfig](https://github.com/lambdadb/lambdadb/blob/ff13daf3f4ed40487b2b13522a141265c2f459ab/api/src/main/java/ai/lambdadb/dto/RerankConfig.java),
[RerankResponse](https://github.com/lambdadb/lambdadb/blob/ff13daf3f4ed40487b2b13522a141265c2f459ab/api/src/main/java/ai/lambdadb/dto/RerankResponse.java),
the query DTOs and contract tests, and the
[design contract](https://github.com/lambdadb/lambdadb/blob/ff13daf3f4ed40487b2b13522a141265c2f459ab/docs/design/native-reranking.md).
This includes the query/candidate limit increase in PR #469 and unindexed stored
string paths in PR #481 (included in backend `main` at
`242a2824d09dac9b1c31385290e6ee3d40ac2ba9`).
A source pin is not evidence of deployment to your endpoint or a published SDK package.

## Request reference

| `rerank` field | Type | Contract |
| --- | --- | --- |
| `provider` | `"typesafe"` | Required. |
| `model` | `"jev-1.13.0"` | Required. |
| `queryText` | `string` | Required nonblank text, up to 8 KiB UTF-8; also required for raw vector queries. |
| `fields` | `string[]` | Required 1–8 unique stored scalar text paths, in model input order. Index declarations are optional; declared leaves must be text/keyword with object ancestors. The backend validates actual stored values. |
| `candidateSize` | `number \| null` | Optional integer; omitted/null defaults to `max(50, size)`. Require `size <= candidateSize <= 1000`. |
| `onFailure` | `"error" \| "returnOriginal" \| null` | Optional; omitted/null defaults to `error`. Applies only to eligible provider failures. |
| `criteria` | `string[] \| null` | Optional 2–10 distinct nonblank descriptions, lowest to highest relevance. Omitted/null uses the default criteria. Each description is at most 2 KiB, with at most 8 KiB total UTF-8. |

The SDK preserves text, criteria order, nulls and omission without inserting
server defaults. It rejects unsupported rerank options and invalid local bounds
before HTTP. Collection field types, candidate data, model availability and
facet restrictions remain server validations. Selected paths must resolve to
stored scalar strings, not arrays or vector values. Missing/null individual
fields contribute no text; a candidate with no nonblank selected text or a
non-string selected value causes a validation error, not fallback. Rendered
candidate input has a 16 KiB limit, and combined query/candidate/custom-criteria
input has a 256 KiB limit, enforced by the server without silent truncation.

Both top-level and nested strings such as `article.body` may be unindexed.
Their object ancestors need no index declarations, and no embedding configuration
is required for the selected path.
Traversal requires stored objects and scalar string leaves; array traversal,
wildcards, and serializing whole objects are unsupported. The server hydrates
selected paths at the pinned read identity before applying public projection.
Unselected siblings are not sent to the reranker. Query predicates, filters,
and sorting still require appropriate indexes. See
[Native embeddings](native-embeddings.md#reranking-and-projection) for an example.

Reranking requires a scoring retrieval query and positive final `size` (up to
1000, server default 10). It cannot accompany `sort`, query-less requests, or
filter-only Boolean queries. Existing ref and `consistentRead` constraints apply.
Facets keep their existing lexical-query support: reranking does not enable
vector or hybrid facets. Supported facets count the full matching set, not just
reranked candidates. Facet-only `size: 0` requests remain available without
reranking.

Three sizes have different meanings:

| Setting | Meaning |
| --- | --- |
| `size` | Final number of returned documents. |
| Each `knn.k` | Candidate count for that dense vector retrieval leg. |
| `rerank.candidateSize` | Upper bound after global merge and deduplication, before reranking. |

The SDK never increases `k`. A vector leg with `k: 20` and a lexical leg can
still contribute to a merged pool capped at 50. For a vector-only search, raise
`k` explicitly to retrieve more candidates. The cap does not guarantee that
many candidates exist; actual counts appear in response metadata.

## Query size and byte limits

Query `size`, dense `knn.k`, Bayesian `candidateSize`, and
`rerank.candidateSize` share a maximum of 1000. The default query `size` remains
10; omitted/null rerank candidate size remains `max(50, size)`. The separate
16 KiB per-candidate and 256 KiB combined rerank text budgets still apply, so
1000 candidates may exceed the input budget or provider deadline.

Query results and hydrated candidate bodies no longer have an aggregate 64 MiB
limit. The server spools document bodies with bounded resources and offloads
large results through the existing `docsUrl` format: a complete JSON document
array with gzip content encoding. Scores, facets, and rerank metadata retain
their existing locations. Internal gRPC messages, transport metadata, and
individual hydration batches retain their separate 64 MiB safeguards.

Encoded bodies and compressed uploads share a process-wide temporary storage
budget, initially 256 MiB and configurable by the server operator. Concurrent
queries compete for it, and multiple representations can coexist, so it is not
a maximum supported response size. Exhaustion returns HTTP 503 with
`Query temporary storage budget is busy; retry later`, without truncation or
partial results. Unexpected local I/O and upload failures also remain server
errors. Storage failures cannot trigger rerank provider fallback, including with
`onFailure: "returnOriginal"`.

The SDK surfaces a final HTTP 503 as `ServiceUnavailableError`; its default
[retry policy](../README.md#retries) applies to both Query and QuerySafe. It
does not implement a local byte budget or rerank fallback. Downloads still read
the complete response text and parse the document array in memory, so client
memory must accommodate the full result. Internal executor streaming requires
no SDK transport change. Facet bucket limits remain 100. Fetch and List now allow 1000; Fetch retains
a separate 64 MiB per-node JSON budget. See the [read contract](OPENAPI_UPDATE.md#updating-fetch-and-list).
See the pinned [server resource-budget contract](https://github.com/lambdadb/lambdadb/blob/234f6f97814bf0d60604fa45ab2907f1fce88b5a/docs/design/query-result-limits.md).

## Default criteria example

This assumes a `bodyEmbedding` vector field configured for native embedding
and stored `title`/`body` text fields. `rerank.fields` selects model input; the
query-level `fields` projection independently selects returned document content.

```typescript
import { LambdaDBClient, type QueryCollectionInput } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY,
});
const collection = client.collection("articles");
const input: QueryCollectionInput = {
  size: 10,
  query: {
    knn: {
      field: "bodyEmbedding",
      queryText: "How do I restore a previous collection version?",
      k: 50,
    },
  },
  fields: { include: ["id", "title"] },
  rerank: {
    provider: "typesafe",
    model: "jev-1.13.0",
    queryText: "How do I restore a previous collection version?",
    fields: ["title", "body"],
  },
};
const result = await collection.query(input);
console.log(result.rerank?.status);
for (const hit of result.docs) {
  console.log(hit.doc, hit.score, hit.retrievalScore);
}
```

## Custom criteria example

Criteria replace the default descriptions for this request. Order them from low
to high relevance. The server supplies the scoring scale; callers cannot supply
weights or thresholds. These descriptions are an example, not a validated rubric.

```typescript
import { createQueryInput, type RerankConfig } from "@functional-systems/lambdadb";

const rerank: RerankConfig = {
  provider: "typesafe",
  model: "jev-1.13.0",
  queryText: "How do I restore a previous collection version?",
  fields: ["title", "body"],
  candidateSize: 50,
  onFailure: "returnOriginal",
  criteria: [
    "Does not explain restoring a collection version.",
    "Provides related information but leaves key restoration steps unanswered.",
    "Explains the restoration steps directly and completely.",
  ],
};
const customInput = createQueryInput(input.query!, { size: 10, rerank });
const customResult = await collection.querySafe(customInput);
if (customResult.ok) {
  console.log(customResult.value.rerank?.status, customResult.value.rerank?.reason);
} else {
  throw customResult.error;
}
```

This continues the default example. `criteria: null` selects the defaults.
The same custom descriptions can produce different scores under a different
model; retain the original request when comparing results.

## Response reference

`score` is the final sorting value in the document envelope. With
`rerank.status === "applied"`, it is a finite evaluation score in [0,1], not a
calibrated relevance probability. The original retrieval/fusion score is in
`retrievalScore` alongside `score`, outside `doc`. The SDK preserves numeric
precision, numeric zero and server ordering; it does not round or sort results.
Exact ties retain the server's original candidate order.

`maxScore` is the maximum final returned score, including zero. Empty rerank
results omit it. `total` counts returned documents, not all corpus matches.
Top-level `took` includes the entire query; `rerank.took` measures the rerank stage.
Both scores and metadata survive automatic `docsUrl` downloads.

| Top-level `rerank` field | Required | Meaning |
| --- | --- | --- |
| `status` | Yes | `applied`, `skipped`, or `fallback`. |
| `provider`, `model` | Yes | Requested provider/model. |
| `resolvedModel` | No | Model reported by the provider, when available. |
| `candidateCount` | Yes | Actual unique candidates in the stage. |
| `scoredCount` | Yes | Complete accepted scores; equals candidateCount on applied, zero on skipped/fallback. |
| `took` | Yes | Stage milliseconds. |
| `criteriaVersion` | No | Only applied: `default-relevance-v1` or `custom`. |
| `reason` | No | Skip/fallback reason code. |

`custom` indicates caller-provided criteria; it is not a content hash or unique
version. The same score under different criteria or models does not mean equal
relevance. No `rerankScore` or `rubricVersion` is supported.

```json
{
  "took": 210,
  "maxScore": 0.80000002,
  "total": 1,
  "docs": [{
    "collection": "articles",
    "score": 0.80000002,
    "retrievalScore": 3.25,
    "doc": { "id": "one", "title": "Restoring a collection" }
  }],
  "isDocsInline": true,
  "rerank": {
    "status": "applied",
    "provider": "typesafe",
    "model": "jev-1.13.0",
    "candidateCount": 4,
    "scoredCount": 4,
    "took": 190,
    "criteriaVersion": "default-relevance-v1"
  }
}
```

Without reranking, metadata and `retrievalScore` are omitted. No candidates
produces `status: "skipped"`, `reason: "noCandidates"`, both counts zero and no
`maxScore` or `criteriaVersion`. Request validation still precedes empty handling.

## Failure behavior

The default `error` policy returns an error for eligible provider failures.
`returnOriginal` returns the first `size` documents from the retained retrieval
candidate order, preserving their search scores and omitting `retrievalScore`.
Metadata reports `status: "fallback"`, `scoredCount: 0`, a reason and no
`criteriaVersion`. Partial rerank scores are discarded atomically. Fallback
search scores are not restricted to [0,1]. A hybrid fallback uses the expanded
fused pool, so it can differ from a separate query with a smaller candidate cap.

Eligible provider reasons are `timeout`, `rateLimit`, `unavailable`,
`invalidResponse`, and `credentials`. Invalid input/candidate text, disabled
models, retrieval/hydration/ref/authorization failures, inference quota failures,
and executor capacity admission failures remain errors. Cancellation or an
exhausted overall request deadline does not start fallback work. `querySafe`
returns these errors as Result values; it does not implement an extra fallback.
