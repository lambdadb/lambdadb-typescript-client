# Native embeddings

Configure a vector field with `embedding` to enable native embeddings. The SDK
preserves the omitted legacy flag and leaves dimensions/similarity defaults to
the server. The contract is pinned to backend
[ff13daf3f4ed40487b2b13522a141265c2f459ab](https://github.com/lambdadb/lambdadb/blob/ff13daf3f4ed40487b2b13522a141265c2f459ab/docs/design/native-embedding-config.md)
(backend PR #481, included in `main` at `242a2824d09dac9b1c31385290e6ee3d40ac2ba9`).
Cohere providers, ordered `sources`, image inputs, `knn.queryInputs`, direct
vectors on native fields, and native-field bulk imports follow the public
OpenAPI at backend `main`
[`1c3e7d453cca296a7b2af85a375b4c5016504101`](https://github.com/lambdadb/lambdadb/blob/1c3e7d453cca296a7b2af85a375b4c5016504101/api/openapi.json)
(added in PR #483); see its [design contract](https://github.com/lambdadb/lambdadb/blob/1c3e7d453cca296a7b2af85a375b4c5016504101/docs/design/native-embedding-config.md).
These source pins do not establish deployment to any endpoint.

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
`article` nor `article.body` needs an index declaration. The equivalent
`sources: [{ field: "article.body", type: "text" }]` form is preferred for new
bindings; use exactly one non-null `sourceField` or `sources`. Omit the native
vector when writing documents; it is generated from the selected sources. Query
native vectors with `knn.queryText` or `knn.queryInputs`. The SDK sends the
original document without a `{text}` wrapper, source remapping, or inferred
source indexes.
For caller-provided vector fields, retain top-level dimensions and use `queryVector`.
Caller-provided vector fields require `queryVector` and do not support
`queryText` or `queryInputs`. Native fields also accept `queryVector`, which
skips inference; the vector must come from a compatible embedding space.
Each KNN query must provide exactly one non-null `queryText`, `queryInputs`, or
`queryVector`. The server enforces these rules; the SDK preserves free-form query
serialization.
Native dimensions and similarity, when explicit, belong inside `embedding`.
Dimensions must be an integer from 64 to 4096, and similarity must be `cosine`
or `euclidean`. The server also enforces each model's supported maximum.
Omitted native dimensions and similarity remain omitted on the wire.

## Ordered and image sources

`provider: "cohere"` supports `embed-v5.0-pro` and `embed-v5.0-fast` with
dimensions 256, 512, 768, 1024, 1536, or 2048 (server default 2048, cosine).
`sources` lists 1–16 original JSON paths in model-input order, each with an
explicit `text` or `image` type. All present parts combine into one vector.
OpenAI requires exactly one text source.

```typescript
await client.createCollection({
  collectionName: "products",
  indexConfigs: {
    productVector: {
      type: "vector",
      embedding: {
        provider: "cohere",
        model: "embed-v5.0-pro",
        dimensions: 1024,
        sources: [
          { field: "product.description", type: "text" },
          { field: "product.images", type: "image" },
        ],
      },
    },
  },
});
const products = client.collection("products");
await products.docs.upsert({ docs: [{ id: "jacket", product: {
  description: "Blue waterproof jacket",
  images: ["https://example.com/front.png", "https://example.com/back.png"],
} }] });
await products.query({ query: { knn: { field: "productVector", k: 10, queryInputs: [
  { type: "text", value: "A similar jacket in red" },
  { type: "image", value: "https://example.com/reference.png" },
] } } });
```

An image source is a public HTTPS URL or a complete PNG, JPEG, GIF, or WebP
`data:` URI, either as a string or a flat string array. Each input allows at
most 16 effective parts, 8 images, 1 MiB of decoded image bytes, and
4,194,304 pixels per image. Query `queryInputs` uses the same part limits;
OpenAI accepts one text part. The stored document keeps URLs and data URIs
unchanged. Use versioned URLs: an unchanged URL does not detect replaced content.

The SDK validates the source list shape locally: 1–16 entries, known types, no
extra members, and exactly one of `sources` or `sourceField`. Path syntax,
duplicate paths, provider/model pairs, provider dimension sets, URLs, image
formats, and byte/pixel limits remain server validations. Cohere availability
depends on the endpoint's provider configuration.

## Source paths and writes

Paths support top-level strings and traversal through objects. Empty path
segments, array traversal, and wildcards are unsupported; only Cohere combines
multiple sources. Declared source leaves must be `text` or `keyword`, and declared
ancestors must be objects. An unindexed text source is checked against the
document; its value must be a scalar string. Explicit null, arrays, numbers,
booleans, and whole objects are rejected before inference for newly supported
source paths. URL-looking strings in text sources are literal text; images
require an explicit `image` source. Other stored values retain their existing
validation and storage behavior.

A missing source on a full upsert skips its vector and inference call. Full
upserts replace the document, so omission does not retain a previous source or
vector. A document may instead supply the native vector field directly, with or
without its sources; the supplied vector takes precedence and skips inference. A misspelled unindexed path may therefore be treated as absent rather
than rejected when creating the Collection.

Partial updates merge with the stored document on the server before evaluating
the source. An omitted or unchanged source preserves the existing vector;
changed text generates a new one. An explicitly supplied vector takes precedence,
and later metadata-only updates retain it. Removing the last source removes an
inherited vector. An empty ancestor patch such as
`{ id: "one", article: {} }` preserves existing text, and an unselected sibling
update does not regenerate the vector. An invalid merged source is rejected.
The SDK sends patches unchanged; it does not read, merge, or embed locally.
Both the original and vector-materialized document retain the server's existing
5 MiB document limit. Source/model bindings remain immutable, with no automatic
reembedding or migration.

Bulk upsert accepts Collections with native embedding fields but never generates
embeddings. Include a compatible precomputed vector for every binding whose
sources are present; a present source without its vector fails before any
documents are committed. Use ordinary upsert to generate embeddings.

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

The Cohere smoke covers ordered text/image sources, typed query inputs, direct
vectors, partial-update vector lifecycle, Cohere reranking, bulk import with caller
vectors and its pre-commit rejection, the OpenAI `sources` form, Cohere legacy
`sourceField`, and HTTP 400 for provider rules the SDK leaves to the server:

```bash
npm run build
node --env-file=/absolute/path/to/checkout/.env.local \
  --test test/integration/cohere-native-live.test.mjs
```

It requires an endpoint with Cohere configured and generates its PNG data URIs
in the test. It does not exercise HTTPS image retrieval.

### Cohere validation on 2026-10-29

The SDK branch based on `44e67c900929a1f2bbfa838dbaade9f537b8b594`, with this
update, passed both Cohere smoke tests against
`https://aws-ap-northeast-2-v3.lambdadb.ai`, project `stest`, in 41.7 seconds
without skips.

- A Collection with `embed-v5.0-fast`, 256 dimensions, and text/image `sources`
  round-tripped its metadata (`sources` only, cosine). Text-only, image-only,
  and mixed documents received vectors; the stored data URI was unchanged, and
  a directly supplied vector was retained.
- KNN `queryText` and `queryVector` returned the expected top documents; mixed
  and image-only `queryInputs` returned an image-bearing document first.
- `rerank-v5.0-fast` and `rerank-v5.0-pro` applied with `cohere-relevance-v1`
  and scores in [0,1].
- Metadata-only updates retained direct and update-supplied vectors, a changed
  source regenerated the vector, an update-supplied vector took precedence, and
  emptying the last image source removed the inherited vector.
- Bulk import committed a caller vector and skipped an empty image array. A
  payload with a present source and no vector returned `BadRequestError` (HTTP
  400), and its valid sibling record was not committed.
- OpenAI `sources` and Cohere legacy `sourceField` (default 2048 dimensions)
  round-tripped. Collection creation returned HTTP 400 for an OpenAI image
  source, two OpenAI sources, Cohere dimensions 1000, an unknown Cohere model,
  duplicate source paths, and a blank path. OpenAI image `queryInputs` returned
  HTTP 400.

All nine temporary Collections were deleted and verified absent with HTTP 404.
The existing native-embedding, stored-text, and native-reranking smokes also
passed against the same endpoint.

Separate probes showed that the server applies field- and provider-dependent
KNN input checks only when the read target has committed data. On an empty
Collection, `queryText`/`queryInputs` on a caller-vector field, OpenAI image or
multi-part `queryInputs`, and Cohere raw base64 or `http://` image values
returned HTTP 200 with no documents; with `consistentRead: true` they returned
HTTP 400. After a write, OpenAI image input returned HTTP 200 until the document
became visible to ordinary reads (42 seconds), then HTTP 400. Generic checks
(empty list, blank value, unknown type) always returned HTTP 400. The cause is
the empty-target return in backend `DocumentQueryService.queryDocuments`, which
precedes native embedding preparation. The SDK forwards the server
response unchanged. The running server's exact source revision, provider call
counts, and billing were not independently verified.

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
