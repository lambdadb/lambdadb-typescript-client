# Qdrant Compatibility Client Design for TypeScript

## Goal

Add an explicit Qdrant-style compatibility adapter to the TypeScript SDK so
existing Qdrant-based JavaScript and TypeScript applications can move common
RAG and vector-search workloads to LambdaDB with minimal application changes:

```diff
- import { QdrantClient, models } from "@qdrant/js-client-rest";
+ import { QdrantCompatClient as QdrantClient, models } from "@functional-systems/lambdadb/compat/qdrant";

- const client = new QdrantClient({ url: "http://localhost:6333" });
+ const client = new QdrantClient({
+   projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY!,
+   projectName: "prod",
+ });
```

This is not a full Qdrant client replacement. The v1 contract should say
"Qdrant-style compatibility layer for common vector-search and RAG migration
paths" rather than "drop-in replacement".

## Implementation Status

This design has been implemented in the TypeScript SDK for the `0.4.0` release.
The public adapter lives at `@functional-systems/lambdadb/compat/qdrant`, with
`@functional-systems/lambdadb/compat/qdrant/models` as a model subpath export.

Implemented additions beyond the original minimum surface:

- `getCollections()` for Qdrant JavaScript integration compatibility.
- `query()` as a Qdrant JS package-style alias around `queryPoints()`.
- External smoke tests for LangChain JS and LlamaIndex TS using an in-process
  fake LambdaDB transport.
- Live smoke tests that load `.env` with `node --env-file-if-exists=.env`.

## Source Alignment

Use the Python compatibility implementation and docs as the behavioral source
for v1:

- `lambdadb-python-client/docs/compatibility/qdrant-design.md`
- `lambdadb-python-client/docs/compatibility/qdrant.md`
- `lambdadb-python-client/src/lambdadb/compat/qdrant/*`
- `lambdadb-python-client/tests/test_qdrant_compat.py`

The TypeScript design should preserve the Python data mapping, error policy,
supported surface, and unsupported-feature boundaries. Differences should only
come from TypeScript/Node packaging, async-only APIs, and the current
collection-scoped `LambdaDBClient` facade.

## Product Decision

Ship an explicit LambdaDB namespace first:

```ts
import { QdrantCompatClient, QdrantClient, models } from "@functional-systems/lambdadb/compat/qdrant";
```

`QdrantClient` should be an alias for `QdrantCompatClient` for ergonomic
migrations, but it still lives under the LambdaDB package namespace. Do not
publish or install a top-level `@qdrant/js-client-rest` replacement in v1. If
import-only migration becomes important, create a separate shim package later
that delegates to this adapter.

## Non-Goals

- Full Qdrant cluster/admin API compatibility.
- Qdrant local mode.
- HNSW, WAL, optimizer, quantization, shard, replica, snapshot, and alias
  semantics.
- Binary or type compatibility with every generated Qdrant model.
- Depending on the real Qdrant JavaScript client at runtime.
- Supporting synchronous methods. The TypeScript SDK should be async-only.

## Target API Surface

### V1 Runtime RAG Subset

| Qdrant-style method | LambdaDB mapping | Notes |
| --- | --- | --- |
| `constructor(...)` | `new LambdaDBClient(...)` or wrapped client | Accept LambdaDB config directly or an existing `LambdaDBClient`. |
| `collectionExists()` / `collection_exists()` | `client.collection(name).get()` | Return `boolean`. Support camelCase first, snake_case aliases if cheap. |
| `getCollection()` / `get_collection()` | collection metadata lookup | Return Qdrant-style config object with vector params. |
| `getCollections()` | collection list lookup | Return `{ collections: [{ name }] }` for JS integration compatibility. |
| `createCollection()` / `create_collection()` | `client.createCollection()` | Dense vectors and named dense vectors. |
| `recreateCollection()` / `recreate_collection()` | delete if exists, then create | Preserve Qdrant convenience behavior. |
| `deleteCollection()` / `delete_collection()` | `client.collection(name).delete()` | Return `boolean`. |
| `createPayloadIndex()` / `create_payload_index()` | merge `indexConfigs`, then `update()` | Empty collections only unless the index already exists. |
| `upsert()` | `collection.docs.upsert()` | Accept `PointStruct`, plain objects, and object-like points. |
| `uploadPoints()` / `upload_points()` | chunked `upsert()` | No parallelism in v1. |
| `uploadCollection()` / `upload_collection()` | columnar input converted to points | Support vectors, ids, and payload arrays. |
| `queryPoints()` / `query_points()` | `collection.query()` | Main search method. |
| `query()` | `queryPoints()` | Support Qdrant JS package-style `{ query, filter, with_payload, with_vector }`. |
| `search()` | alias to `queryPoints()` | Legacy compatibility returning `ScoredPoint[]`. |
| `retrieve()` | `collection.docs.fetch()` | Strongly consistent fetch. |
| `delete()` | `collection.docs.delete()` | Point IDs and supported Qdrant filters. |
| `scroll()` | `collection.docs.list()` | Unfiltered, no vectors, best-effort cursor semantics. |
| `count()` | collection metadata `numDocs` | Unfiltered count only. |

### V2 Coverage Candidates

- Sparse vectors.
- Broader Qdrant model and method coverage driven by real integrations.
- `withPayload` and `withVectors` selector variants beyond boolean.
- Optional shim package for Qdrant import compatibility.

## Proposed Package Layout

Keep generated Speakeasy files untouched. Add a hand-written compatibility
layer above the public `LambdaDBClient` facade:

```text
src/compat/
  qdrant.ts
  qdrant/
    client.ts
    models.ts
    conversions.ts
    filters.ts
    errors.ts
```

`src/compat/qdrant.ts` is the public subpath entrypoint:

```ts
export { QdrantCompatClient, QdrantClient } from "./qdrant/client.js";
export * as models from "./qdrant/models.js";
export * from "./qdrant/errors.js";
```

Update `package.json` and `tshy.exports` with explicit subpaths:

```json
{
  "exports": {
    "./compat/qdrant": {
      "import": {
        "@functional-systems/lambdadb/source": "./src/compat/qdrant.ts",
        "types": "./dist/esm/compat/qdrant.d.ts",
        "default": "./dist/esm/compat/qdrant.js"
      },
      "require": {
        "types": "./dist/commonjs/compat/qdrant.d.ts",
        "default": "./dist/commonjs/compat/qdrant.js"
      }
    },
    "./compat/qdrant/models": {
      "import": {
        "@functional-systems/lambdadb/source": "./src/compat/qdrant/models.ts",
        "types": "./dist/esm/compat/qdrant/models.d.ts",
        "default": "./dist/esm/compat/qdrant/models.js"
      },
      "require": {
        "types": "./dist/commonjs/compat/qdrant/models.d.ts",
        "default": "./dist/commonjs/compat/qdrant/models.js"
      }
    }
  }
}
```

The existing wildcard exports may happen to work for nested paths, but explicit
exports make this adapter a supported public surface.

## Client Initialization

Support two initialization styles.

### Wrap an Existing LambdaDB Client

```ts
import { LambdaDBClient } from "@functional-systems/lambdadb";
import { QdrantCompatClient } from "@functional-systems/lambdadb/compat/qdrant";

const ldb = new LambdaDBClient({ projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY });
const client = new QdrantCompatClient(ldb);
```

The wrapper should accept anything with the public LambdaDB shape:

```ts
type LambdaDBLike = {
  createCollection(request: CreateCollectionInput, options?: ClientRequestOptions): Promise<unknown>;
  collection(name: string): CollectionLike;
};
```

### Construct Directly

```ts
const client = new QdrantCompatClient({
  projectApiKey: "...",
  baseUrl: "https://api.lambdadb.ai",
  projectName: "prod",
});
```

Also accept common Qdrant constructor names where they can be safely mapped:

| Qdrant-style option | Handling |
| --- | --- |
| `apiKey` / `api_key` | Alias for `projectApiKey`. |
| `url` | Alias for LambdaDB `baseUrl`; warn if it looks like local Qdrant. |
| `host`, `port`, `https`, `prefix` | Best-effort URL construction. |
| `timeout` | Convert seconds to request timeout if the SDK exposes a compatible timeout option; otherwise warn. |
| `path`, `location: ":memory:"` | Throw `UnsupportedQdrantFeatureError`. |
| Unknown options | Warn once and ignore. |

Prefer camelCase public options in examples. Snake_case aliases are acceptable
to match Python and common Qdrant snippets.

## Model Layer

Implement a small model subset as TypeScript classes or factory-friendly data
types. They should support both class construction and plain object input:

```ts
new models.PointStruct({
  id: 1,
  vector: [0.1, 0.2, 0.3],
  payload: { tenant: "acme" },
});

client.upsert("docs", {
  points: [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { tenant: "acme" } }],
});
```

Minimum exports:

- `PointStruct`
- `VectorParams`
- `SparseVector`
- `Distance`
- `PayloadSchemaType`
- `Filter`
- `FieldCondition`
- `HasIdCondition`
- `MatchValue`
- `MatchAny`
- `MatchExcept`
- `MatchText`
- `Range`
- `SearchParams`
- `UpdateStatus`
- `ScoredPoint`
- `Record`
- `QueryResponse`
- `UpdateResult`
- `CountResult`

Recommended approach:

- Use lightweight classes with `constructor(init)` and public fields.
- Accept plain objects in conversion helpers through `fromAny` functions.
- Keep extra fields on model instances if trivial, but reject unsupported
  result-changing fields during conversion or client method execution.
- Avoid adding a runtime dependency beyond existing `zod`; this layer does not
  need full generated model validation.

## Data Mapping

Preserve the Python adapter mapping.

| Qdrant concept | LambdaDB mapping |
| --- | --- |
| point id | document `id`, stringified |
| original numeric id | `_qdrant_id` reserved field |
| unnamed dense vector | `_qdrant_vector` |
| named dense vector `title` | `_qdrant_vector_title` |
| payload fields | top-level document fields |

Payload fields must not be `id` and must not use the reserved `_qdrant_`
prefix. Reject collisions before making network calls.

### Single Dense Vector

```ts
// Qdrant-style point
new models.PointStruct({
  id: 1,
  vector: [0.1, 0.2, 0.3],
  payload: { text: "hello" },
});

// LambdaDB document
{
  id: "1",
  _qdrant_id: 1,
  _qdrant_vector: [0.1, 0.2, 0.3],
  text: "hello",
}
```

### Named Dense Vectors

```ts
// Qdrant-style point
new models.PointStruct({
  id: 1,
  vector: { title: [0.1, 0.2], body: [0.3, 0.4] },
  payload: { text: "hello" },
});

// LambdaDB document
{
  id: "1",
  _qdrant_id: 1,
  _qdrant_vector_title: [0.1, 0.2],
  _qdrant_vector_body: [0.3, 0.4],
  text: "hello",
}
```

### Sparse Vectors

Sparse vector model construction can exist in v1, but sparse upsert/query must
detect Qdrant sparse-vector shapes and throw `UnsupportedQdrantFeatureError`
before writing. This matches the Python implementation status.

A future phase can map Qdrant sparse vectors to LambdaDB sparse-vector fields:

```ts
new models.SparseVector({ indices: [1, 7], values: [0.3, 0.9] });

// Future LambdaDB sparse-vector field shape
{ indices: [1, 7], values: [0.3, 0.9] }
```

## Collection Mapping

`createCollection()` should accept Qdrant-style vector config and optional
payload schema:

```ts
await client.createCollection("docs", {
  vectorsConfig: new models.VectorParams({
    size: 1536,
    distance: models.Distance.COSINE,
  }),
  payloadSchema: {
    tenant: models.PayloadSchemaType.KEYWORD,
    views: models.PayloadSchemaType.INTEGER,
  },
});
```

LambdaDB request:

```ts
await ldb.createCollection({
  collectionName: "docs",
  indexConfigs: {
    _qdrant_vector: {
      type: "vector",
      dimensions: 1536,
      similarity: "cosine",
    },
    tenant: { type: "keyword" },
    views: { type: "long" },
  },
});
```

Distance mapping:

| Qdrant distance | LambdaDB similarity |
| --- | --- |
| `COSINE` / `"Cosine"` | `cosine` |
| `DOT` / `"Dot"` | `dot_product` |
| `EUCLID` / `"Euclid"` | `euclidean` |
| `MANHATTAN` / `"Manhattan"` | throw in v1 |

Payload schema mapping:

| Qdrant payload schema | LambdaDB index type |
| --- | --- |
| `keyword` | `keyword` |
| `integer` | `long` |
| `float` | `double` |
| `bool` | `boolean` |
| `datetime` | `datetime` |
| `text` | `text` |
| `uuid` | `keyword` |
| `geo` | throw in v1 |

`createPayloadIndex()` should read current collection metadata, merge a payload
index into the full `indexConfigs` object, then call `collection.update()`. If
`numDocs > 0`, it should only return success when the same index already exists;
otherwise throw because LambdaDB does not backfill newly added index configs for
existing documents.

## Query And Filter Mapping

`queryPoints()` should map dense vector search to LambdaDB `knn`:

```ts
await client.queryPoints("docs", {
  query: [0.1, 0.2, 0.3],
  queryFilter: new models.Filter({
    must: [
      new models.FieldCondition({
        key: "tenant",
        match: new models.MatchValue({ value: "acme" }),
      }),
    ],
  }),
  limit: 10,
  withPayload: true,
  withVectors: false,
});
```

LambdaDB request:

```ts
await ldb.collection("docs").query({
  query: {
    knn: {
      field: "_qdrant_vector",
      k: 10,
      queryVector: [0.1, 0.2, 0.3],
      filter: { queryString: { query: "tenant:acme" } },
    },
  },
  size: 10,
  consistentRead: true,
  includeVectors: false,
});
```

Keep filter translation isolated in `filters.ts`.

Supported v1 filters:

| Qdrant filter | TypeScript behavior |
| --- | --- |
| `Filter.must` | LambdaDB bool clause with `occur: "filter"` |
| `Filter.should` | LambdaDB bool clause with `occur: "should"` |
| `Filter.must_not` / `mustNot` | LambdaDB bool clause with `occur: "must_not"` |
| `FieldCondition.match = MatchValue` | query string equality |
| `FieldCondition.match = MatchAny` | multiple should/filter clauses |
| `FieldCondition.match = MatchExcept` | negated clauses |
| `FieldCondition.range` | query string range |
| `HasIdCondition` | `id:<value>` query string |
| `MatchText` | throw in v1 |
| Geo/nested filters | throw in v1 |

Unsupported result-changing options must throw before network calls. Examples:
`offset`, `scoreThreshold`, shard routing, filtered scroll, and filtered count.
Performance-only options such as `searchParams` may warn and continue.

The filter DSL policy is no longer an open design question from the Python
implementation: v1 uses LambdaDB `queryString` leaves and `bool` clauses, and
keeps that translation isolated in the compatibility layer.

## Response Mapping

Return Qdrant-style objects rather than raw LambdaDB responses.

Write operations:

```ts
new models.UpdateResult({
  operationId: undefined,
  status: models.UpdateStatus.COMPLETED,
});
```

Query response:

```ts
new models.QueryResponse({
  points: [
    new models.ScoredPoint({
      id: 1,
      score: 0.9,
      payload: { tenant: "acme" },
      vector: [0.1, 0.2],
    }),
  ],
});
```

`search()` should return `ScoredPoint[]`, matching older Qdrant examples.
`retrieve()` should return `Record[]`. `scroll()` should return a tuple-like
`[Record[], nextPageOffset]`.

When LambdaDB returns inline docs as `{ docs: [{ doc, score }] }`, unwrap `doc`.
If the public `CollectionHandle` already fetched a `docsUrl`, rely on that
facade rather than duplicating docs-url download logic.

## Error Policy

Add adapter-specific errors:

```text
QdrantCompatError extends Error
UnsupportedQdrantFeatureError extends QdrantCompatError
QdrantCompatValidationError extends QdrantCompatError
```

Map LambdaDB not-found errors during `collectionExists()` to `false`. Other
LambdaDB errors should pass through unless a clearer adapter error is available.

Use:

- `QdrantCompatValidationError` for malformed points, conflicting payload
  schema, reserved fields, and incompatible inputs.
- `UnsupportedQdrantFeatureError` for valid Qdrant features that v1 does not
  support.
- `console.warn()` or `process.emitWarning()` for ignored options that do not
  change result correctness.

## Method Shape

Support the idiomatic JS client style first:

```ts
await client.createCollection("docs", { vectorsConfig });
await client.upsert("docs", { points });
await client.queryPoints("docs", { query, queryFilter, limit: 10 });
```

Also accept Python-like object parameters if the implementation remains small:

```ts
await client.create_collection({
  collection_name: "docs",
  vectors_config: vectorsConfig,
});
```

Do not let method-shape flexibility leak into LambdaDB calls. Normalize once at
the method boundary, then conversion helpers should operate on a single internal
shape.

## Implementation Plan

### Step 1: Skeleton And Exports

- Add `src/compat/qdrant.ts`.
- Add `src/compat/qdrant/{client,models,errors}.ts`.
- Export `QdrantCompatClient`, `QdrantClient`, `models`, and errors.
- Add explicit package exports for `./compat/qdrant` and
  `./compat/qdrant/models`.

Exit criteria:

- `import { QdrantCompatClient, QdrantClient, models } from "@functional-systems/lambdadb/compat/qdrant"` works after `npm run build`.
- `import { PointStruct } from "@functional-systems/lambdadb/compat/qdrant/models"` works if that subpath is kept.

### Step 2: Conversion Helpers

- Add `conversions.ts` with:
  - point-to-doc conversion
  - doc-to-record conversion
  - query-result-to-scored-point conversion
  - vector field naming
  - distance/similarity mapping
  - payload schema/index config mapping
  - reserved payload validation

Exit criteria:

- Unit tests cover dense vector, named vector, payload merge, numeric IDs,
  string IDs, reserved fields, payload schema mapping, unsupported distance,
  and sparse-vector rejection.

### Step 3: Collection Operations

- Implement collection existence, metadata, create, recreate, delete, and
  payload-index update behavior.
- Wait for collection `ACTIVE` after create/update only if this is needed for
  parity with Python live tests. Keep the polling helper isolated.

Exit criteria:

- Fake-client tests assert exact `createCollection()` and `update()` payloads.
- Existing payload index on a non-empty collection is idempotent.
- New payload index on a non-empty collection throws.

### Step 4: Write And Read Operations

- Implement `upsert`, `uploadPoints`, `uploadCollection`, `retrieve`, and
  delete-by-ID.
- Return Qdrant-style `UpdateResult` and `Record` objects.

Exit criteria:

- Plain object and model-instance points both work.
- LambdaDB docs calls receive exact expected docs.
- Delete-by-filter converts through the same `filters.ts` path used by
  `queryPoints()`.

### Step 5: Query And Filter Operations

- Implement `filters.ts`.
- Implement `queryPoints` and `search`.
- Support boolean `withPayload` and `withVectors`.

Exit criteria:

- Basic nearest-neighbor query maps to `query.knn`.
- `limit` maps to both `knn.k` and `size`.
- `consistentRead: true` and `includeVectors` use the TS SDK's camelCase
  request-body fields.
- Equality, range, `must`, `should`, `mustNot`, and `MatchExcept` convert to
  the same LambdaDB query objects as Python, adjusted for JS casing.

### Step 6: Tests And Integration Smoke

- Add unit tests under `test/qdrant-compat.test.mjs`.
- Use fake LambdaDB clients for deterministic tests.
- Add an opt-in live test script after unit behavior is stable.
- Add optional external integration smoke tests for LangChain JS and LlamaIndex
  TS if their Qdrant adapters can run against this in-process compatibility
  client shape.

Suggested commands:

```bash
npm run build
npm run lint
npm test
```

Optional live smoke:

```bash
cp .env.example .env
# Fill in LAMBDADB_PROJECT_API_KEY and set LAMBDADB_RUN_LIVE_TESTS=1.
npm run test:live:qdrant
```

External smoke uses an in-process fake LambdaDB client, so it does not require
LambdaDB credentials and matches the Python external integration test strategy.

Implemented external smoke command:

```bash
npm run test:external:qdrant
```

## Documentation

The public compatibility guide lives at `docs/compatibility/qdrant.md` and
contains:

- Migration import snippet from Qdrant JS client to LambdaDB compat client.
- Basic usage example with collection creation, payload schema, upsert, and
  query.
- Supported method table.
- Unsupported Qdrant features table.
- Payload index caveat.
- Data mapping table.
- Filter support table.

Also add a short README section that links to the compatibility doc. Keep the
compatibility docs under `docs/compatibility/` so future Pinecone or other
database adapters can share the same structure.

Avoid saying "drop-in replacement" without qualification.

## Release Plan

This is additive and should ship as a minor version bump.

Release checklist:

- Compatibility adapter source and tests.
- Explicit subpath exports.
- README and compatibility docs.
- `package.json` and `package-lock.json` version alignment.
- Generated `dist` only if this repo's release flow expects it checked in.

## Resolved Python V1 Decisions To Carry Over

The latest Python implementation resolved several questions that the TypeScript
design should inherit unless a TypeScript-specific constraint appears:

1. LambdaDB filter translation uses `queryString` and `bool` clauses.
2. `upsert()` returns Qdrant-style `COMPLETED` for compatibility.
3. LangChain and LlamaIndex are the first external integration smoke targets.
4. Future work includes sparse vectors, broader Qdrant coverage, optional import
   shim, and async parity where the target SDK has distinct sync/async clients.

## Resolved TypeScript Decisions

1. The adapter supports camelCase methods first and includes snake_case method
   aliases where they map cleanly.
2. Warning behavior uses `console.warn()` for browser-friendly runtime behavior.
3. `getCollection()` returns plain Qdrant-style metadata objects that satisfy
   the integration-facing field shape.

## Implementation Notes

The `0.4.0` implementation:

- Sits above `LambdaDBClient` and avoids generated-file edits.
- Preserves Python adapter behavior for data mapping and unsupported features.
- Normalizes TypeScript inputs at method boundaries.
- Uses SDK camelCase fields when calling LambdaDB (`indexConfigs`,
  `consistentRead`, `includeVectors`).
- Fails unsupported result-changing features before network calls.
- Keeps filter translation isolated so backend query DSL changes do not touch
  client method bodies.

## Future Work

- Sparse vector compatibility: map Qdrant sparse vectors onto LambdaDB
  sparse-vector fields once the backend/indexing contract is finalized.
- Broader Qdrant coverage driven by real integration demand, especially model
  shapes and method variants used by popular JavaScript RAG libraries.
- Selector parity for non-boolean `withPayload` / `withVectors` field lists.
- Payload index lifecycle improvements, including safe backfill or reindex
  support if LambdaDB adds server-side support for applying new indexes to
  existing documents.
- Filter expansion for `MatchText`, nested payload fields, and geo conditions
  when equivalent LambdaDB query semantics are available.
- Query/search tuning policy for Qdrant options such as `scoreThreshold`,
  `hnsw_ef`, and exact-search hints if LambdaDB exposes compatible controls.
- Optional import-only shim package for applications that need to keep
  `@qdrant/js-client-rest` imports while delegating to this adapter.
- External integration matrix maintenance: keep LangChain JS and LlamaIndex TS
  smoke tests current and add more adapters when customer workloads require
  them.
