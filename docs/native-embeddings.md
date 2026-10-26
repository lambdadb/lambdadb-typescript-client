# Native embeddings

Configure a vector field with `embedding` to enable native embeddings. The SDK
preserves the omitted legacy flag and leaves dimensions/similarity defaults to
the server. The contract is pinned to backend
[ff13daf3f4ed40487b2b13522a141265c2f459ab](https://github.com/lambdadb/lambdadb/blob/ff13daf3f4ed40487b2b13522a141265c2f459ab/docs/design/native-embedding-config.md)
(backend PR #481, included in `main` at `242a2824d09dac9b1c31385290e6ee3d40ac2ba9`).
This source pin does not establish deployment to any endpoint.

```typescript
import { LambdaDBClient, type IndexConfigsNativeEmbeddingVector } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ projectApiKey: "<YOUR_PROJECT_API_KEY>" });
const vector: IndexConfigsNativeEmbeddingVector = {
  type: "vector",
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    sourceField: "article.body",
  },
};
await client.createCollection({
  collectionName: "documents",
  indexConfigs: { vector },
});
const collection = client.collection("documents");
await collection.docs.upsert({ docs: [{
  id: "one", article: { body: "Restore a saved version.", title: "Recovery" },
}] });
const response = await collection.query({
  query: { knn: { field: "vector", queryText: "How do I restore a version?", k: 30 } },
});
console.log(response.docs);
```

`sourceField` selects a dot-separated path in the original stored JSON. Neither
`article` nor `article.body` needs an index declaration. Omit the native vector
when writing documents; it is generated from the selected string. Query native
vectors with `knn.queryText`. The SDK sends the original document without a
`{text}` wrapper, source remapping, or inferred source indexes.
For caller-provided vector fields, retain top-level dimensions and use `queryVector`.
Native embedding fields also accept a direct `queryVector`; each KNN query must
provide exactly one non-null `queryText` or `queryVector`. Only native embedding
fields support `queryText`.
Native dimensions and similarity, when explicit, belong inside `embedding`.
Bulk upsert remains unsupported for Collections with native embedding fields.

## Source paths and writes

Paths support top-level strings and traversal through objects. Empty path
segments, array traversal, wildcards, and combining multiple source fields are
unsupported. Declared source leaves must be `text` or `keyword`, and declared
ancestors must be objects. An unindexed source is checked against the document;
its value must be a scalar string. Explicit null, arrays, numbers, booleans, and
whole objects are rejected before inference for newly supported source paths.
URL-looking strings are literal text. Other stored values retain their existing
validation and storage behavior.

A missing source on a full upsert skips its vector and inference call. Full
upserts replace the document, so omission does not retain a previous source or
vector. A misspelled unindexed path may therefore be treated as absent rather
than rejected when creating the Collection.

Partial updates merge with the stored document on the server before evaluating
the source. An omitted or unchanged source preserves the existing vector;
changed text generates a new one. An empty ancestor patch such as
`{ id: "one", article: {} }` preserves existing text, and an unselected sibling
update does not regenerate the vector. An invalid merged source is rejected.
The SDK sends patches unchanged; it does not read, merge, or embed locally.
Both the original and vector-materialized document retain the server's existing
5 MiB document limit. Source/model bindings remain immutable, with no automatic
reembedding or migration.

## Reranking and projection

Use the same stored path for [native reranking](native-reranking.md), independently
of index declarations or whether that path supplies a native embedding:

```typescript
const reranked = await collection.query({
  query: { knn: { field: "vector", queryText: "Restore a saved version", k: 30 } },
  rerank: {
    provider: "typesafe", model: "jev-1.13.0",
    queryText: "Restore a saved version", fields: ["article.body"],
  },
  fields: { include: ["id", "article.title"] },
});
console.log(reranked.docs);
```

The server hydrates selected rerank text before applying the public field
projection; unselected siblings are not sent to the reranker. Stored JSON
projection does not require indexes. Lexical predicates, filters, sorting, and
other index-backed operations still require appropriate indexes. Existing text
indexes remain usable, and a compatible source index may be added through the
existing additive Collection update API.

## Compatibility

`managedEmbedding: true` remains accepted for older servers. The existing
`IndexConfigsManagedEmbeddingVector` type and JSON helpers retain their required
true flag and remain available. New code should prefer
`IndexConfigsNativeEmbeddingVector` and omit the flag. Servers predating the
simplified input reject it; use the explicit legacy flag with those deployments.
Explicit false cannot be combined with `embedding`.

Unindexed sources additionally require upgraded Collection validation, write
runtimes, and rerank preparation. The legacy flag does not bypass those
requirements. Keep indexed sources on older deployments until participating
runtimes support the pinned contract.

The deployed server still returns `managedEmbedding: true` in normalized
Collection metadata; the SDK preserves that response. No stored-schema migration
or default flag insertion occurs in the SDK.

For [Bayesian search](bayesian-search.md), specify top-level `candidateSize`
without rerank. Ordinary KNN/text/RRF/Min-Max/L2 queries do not require this field.

## Live validation

With the intended deployed environment's `LAMBDADB_BASE_URL`,
`LAMBDADB_PROJECT_NAME`, and `LAMBDADB_PROJECT_API_KEY` loaded, run:

```bash
npm run build
node --test test/integration/native-embedding-live.test.mjs
```

The test fails if credentials are missing. It creates temporary native and legacy
Collections, resubmits embedding-only configuration on update, verifies normalized
metadata, executes ordinary KNN without a top-level candidate budget, actual
OpenAI document/query embeddings, and Bayesian retrieval,
and deletes the Collections with 404 verification. Keep keys out of logs and
commits. Source pins alone do not establish deployment.

The separate stored-text smoke exercises unindexed top-level and nested sources,
keyword sources, document preservation, partial updates, source validation,
reranking with projection, and verified cleanup:

```bash
npm run build
node --env-file=/absolute/path/to/checkout/.env.local \
  --test test/integration/native-stored-text-live.test.mjs
```

It requires the same credentials and an endpoint supporting backend #481.
Its assertions do not measure provider call counts or inference billing.

### Stored-source validation on 2026-10-26

The SDK worktree based on `374ef91cf59e373a0ddb2a66bc47b8ff9ee81833`, with
this documentation and regression update, passed the stored-text smoke against
`https://internal-dev-aws-apne2-v3-c05a2b5d492a.lambdadb.ai`, project
`writer-perf-steven`, using the source checkout's `.env.local`.
All three cases (unindexed top-level, unindexed nested, and keyword source)
passed in 13.82 seconds with no skips. Each verified vector generation, KNN
`queryText`, applied reranking using both the source and a separate unindexed
string, ID-only public projection, sibling preservation, unchanged/omitted
source patches, changed-source vector regeneration, HTTP 400 for non-string
sources, and full replacement without the previous source or vector. The nested
case also verified empty ancestor and sibling patches. All three temporary
Collections were deleted and their absence verified with HTTP 404.

`npm ci`, lint, typecheck, package-consumer type checks, and all 213 unit tests
passed. These observations establish the tested behavior at that endpoint;
the running server's exact source revision, provider call counts, and inference
billing were not independently verified. No deployment or publication was
performed.

### Historical indexed-source validation

Validated on `dev-aws-apne2-v3` at backend revision
`9072a1bc8925954369a887f558f1eaf387b7ea0e`: both embedding-only and legacy true
inputs passed create/update, normalized metadata, ordinary KNN, and Bayesian
retrieval in 4.72 seconds. Both temporary Collections were deleted and verified
absent. Lint, typecheck, declaration consumers, and all 186 unit tests passed.
