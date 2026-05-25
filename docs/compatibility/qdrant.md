# Qdrant Compatibility

LambdaDB provides an explicit Qdrant-style compatibility client for common
vector-search and RAG migration paths:

```ts
import { QdrantCompatClient, models } from "@functional-systems/lambdadb/compat/qdrant";

const client = new QdrantCompatClient({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
  baseUrl: "https://api.lambdadb.ai",
  projectName: "playground",
});
```

The compatibility layer is not a full Qdrant JavaScript client replacement. It
maps the common dense-vector subset onto LambdaDB and raises
`UnsupportedQdrantFeatureError` for unsupported behavior where possible.

## Migration Shape

For v1, switch the import and client construction explicitly:

```diff
- import { QdrantClient, models } from "@qdrant/js-client-rest";
+ import { QdrantCompatClient as QdrantClient, models } from "@functional-systems/lambdadb/compat/qdrant";

- const client = new QdrantClient({ url: "http://localhost:6333" });
+ const client = new QdrantClient({
+   projectApiKey: "<YOUR_PROJECT_API_KEY>",
+   baseUrl: "https://api.lambdadb.ai",
+   projectName: "playground",
+ });
```

## Basic Usage

Declare payload fields used in filters when the collection is created:

```ts
await client.createCollection("docs", {
  vectorsConfig: new models.VectorParams({
    size: 3,
    distance: models.Distance.COSINE,
  }),
  payloadSchema: {
    tenant: models.PayloadSchemaType.KEYWORD,
  },
});

await client.upsert("docs", {
  points: [
    new models.PointStruct({
      id: 1,
      vector: [1.0, 0.0, 0.0],
      payload: { tenant: "acme", title: "alpha" },
    }),
  ],
});

const result = await client.queryPoints("docs", {
  query: [1.0, 0.0, 0.0],
  queryFilter: new models.Filter({
    must: [
      new models.FieldCondition({
        key: "tenant",
        match: new models.MatchValue({ value: "acme" }),
      }),
    ],
  }),
  limit: 10,
});
```

## Supported Surface

| Qdrant-style API | Status | Notes |
| --- | --- | --- |
| `QdrantCompatClient(...)` | Supported | Accepts LambdaDB config directly or an existing LambdaDB client. |
| `collectionExists()` / `collection_exists()` | Supported | Maps to LambdaDB collection metadata lookup. |
| `getCollection()` / `get_collection()` | Supported | Returns minimal Qdrant-style collection metadata used by integrations. |
| `getCollections()` | Supported | Returns `{ collections: [{ name }] }` for Qdrant JS integration compatibility. |
| `createCollection()` / `create_collection()` | Supported | Dense vectors and named dense vectors. Use `payloadSchema` for filter fields. |
| `recreateCollection()` / `recreate_collection()` | Supported | Deletes the collection if it exists, then creates it. |
| `deleteCollection()` / `delete_collection()` | Supported | Maps to LambdaDB collection delete. |
| `createPayloadIndex()` / `create_payload_index()` | Limited | Only supported for empty collections unless the same index already exists. |
| `upsert()` | Supported | Dense vectors only. Qdrant IDs become LambdaDB document IDs. |
| `uploadPoints()` / `upload_points()` | Supported | Batches points through `upsert()`. |
| `uploadCollection()` / `upload_collection()` | Supported | Converts vectors, ids, and payload arrays into points. |
| `retrieve()` | Supported | Uses strongly consistent LambdaDB fetches. Supports boolean and field-list payload/vector selectors. |
| `queryPoints()` / `query_points()` | Supported | Dense vector query plus simple payload filters. Supports boolean and field-list payload/vector selectors. |
| `query()` | Supported | Qdrant JS package-style alias around `queryPoints()` using `filter`, `with_payload`, and `with_vector`. |
| `search()` | Supported | Wrapper around `queryPoints()`. |
| `delete()` | Supported | Point IDs and supported Qdrant filters. Accepts `{ points: [...] }`, `{ pointsSelector: [...] }`, `{ filter }`, and `{ pointsSelector: { filter } }`. |
| `scroll()` | Limited | Unfiltered scroll with payload/vector response selectors. |
| `count()` | Limited | Unfiltered collection count only. |

## Payload Indexes

LambdaDB filter fields must be indexed. For the safest Qdrant migration path,
declare those fields at collection creation time:

```ts
payloadSchema: {
  tenant: models.PayloadSchemaType.KEYWORD,
  views: models.PayloadSchemaType.INTEGER,
  score: models.PayloadSchemaType.FLOAT,
  active: models.PayloadSchemaType.BOOL,
}
```

Mapping:

| Qdrant payload schema | LambdaDB index type |
| --- | --- |
| `keyword` | `keyword` |
| `integer` | `long` |
| `float` | `double` |
| `bool` | `boolean` |
| `datetime` | `datetime` |
| `text` | `text` |
| `uuid` | `keyword` |
| `geo` | Unsupported |

`createPayloadIndex()` is intentionally limited. LambdaDB collection updates
replace `indexConfigs`, so the compatibility client reads the existing configs,
merges the new payload index, and sends the full merged set. LambdaDB currently
applies newly added index configs only to documents written after the change, so
adding a new payload index to a non-empty collection is rejected. Recreate the
collection with `payloadSchema` or reingest documents after adding the index.

## Data Mapping

| Qdrant concept | LambdaDB mapping |
| --- | --- |
| point id | document `id`, stringified |
| original numeric id | `_qdrant_id` reserved field |
| unnamed dense vector | `_qdrant_vector` |
| named dense vector `title` | `_qdrant_vector_title` |
| payload fields | top-level document fields |

Payload fields cannot use `id` or the reserved `_qdrant_` prefix.

## Payload And Vector Selectors

Boolean selectors work as expected:

```ts
await client.queryPoints("docs", {
  query: [1.0, 0.0, 0.0],
  withPayload: true,
  withVectors: false,
});
```

Field-list payload selectors are mapped to LambdaDB `fields.include` and are
also applied to the Qdrant-style response payload:

```ts
await client.query("docs", {
  query: [1.0, 0.0, 0.0],
  with_payload: ["tenant", "title"],
});
```

Vector-name selectors request vectors from LambdaDB and filter the returned
Qdrant-style vector object by Qdrant vector name:

```ts
await client.query("docs", {
  query: [1.0, 0.0, 0.0],
  with_vector: ["title"],
});
```

`scroll()` maps to LambdaDB list documents. LambdaDB list responses include
stored vector values, so the compatibility layer applies Qdrant-style vector
selectors while shaping the response.

## Filter Support

| Qdrant filter | Status |
| --- | --- |
| `Filter.must` | Supported |
| `Filter.should` | Supported through LambdaDB bool clauses |
| `Filter.must_not` / `mustNot` | Supported |
| `FieldCondition.match=MatchValue` | Supported |
| `FieldCondition.match=MatchAny` | Supported |
| `FieldCondition.match=MatchExcept` | Supported |
| `FieldCondition.range` | Supported |
| `HasIdCondition` | Supported |
| `MatchText` | Unsupported in v1 |
| Geo filters | Unsupported |
| Nested object filters | Unsupported |

## Unsupported In v1

- Local Qdrant mode (`path`, `location: ":memory:"`)
- Sparse vectors
- Multi-vector comparators
- Geo payload indexes and geo filters
- Filtered scroll
- Filtered count
- `queryPoints()` offset
- `scoreThreshold`
- HNSW/search tuning semantics beyond warnings

## Live Test

Live tests are opt-in and can load credentials from a local `.env` file:

```bash
cp .env.example .env
```

Set:

```bash
LAMBDADB_RUN_LIVE_TESTS=1
LAMBDADB_PROJECT_API_KEY=...
LAMBDADB_PROJECT_NAME=playground
LAMBDADB_BASE_URL=https://api.lambdadb.ai
```

Run:

```bash
npm run test:live:qdrant
```

The script uses `node --env-file-if-exists=.env`, so no extra `dotenv`
dependency is required. `.env` is ignored by git.

## External Integration Smoke

Optional external smoke tests exercise LangChain JS and LlamaIndex TS against
the compatibility client with an in-process fake LambdaDB transport:

```bash
npm run test:external:qdrant
```

These tests do not require LambdaDB credentials.

## Design Notes

Internal design notes live in [qdrant-design.md](qdrant-design.md).
