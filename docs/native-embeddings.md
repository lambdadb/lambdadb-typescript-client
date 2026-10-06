# Native embeddings

Configure a vector field with `embedding` to enable native embeddings. The SDK
preserves the omitted legacy flag and leaves dimensions/similarity defaults to
the server. The contract is pinned to backend
[9072a1bc8925954369a887f558f1eaf387b7ea0e](https://github.com/lambdadb/lambdadb/blob/9072a1bc8925954369a887f558f1eaf387b7ea0e/docs/design/native-embedding-config.md).

```typescript
import { LambdaDBClient, type IndexConfigsNativeEmbeddingVector } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ projectApiKey: "<YOUR_PROJECT_API_KEY>" });
const vector: IndexConfigsNativeEmbeddingVector = {
  type: "vector",
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
    sourceField: "body",
  },
};
await client.createCollection({
  collectionName: "documents",
  indexConfigs: { body: { type: "text" }, vector },
});
const collection = client.collection("documents");
await collection.docs.upsert({ docs: [{ id: "one", body: "Restore a saved version." }] });
const response = await collection.query({
  query: { knn: { field: "vector", queryText: "How do I restore a version?", k: 30 } },
});
console.log(response.docs);
```

Declare the source as a text field. Omit the native vector when writing documents;
it is generated from the source text. Query native vectors with `knn.queryText`.
For caller-provided vectors, retain top-level dimensions and use `queryVector`.
Native dimensions and similarity, when explicit, belong inside `embedding`.
Bulk upsert remains unsupported for Collections with native embedding fields.

`managedEmbedding: true` remains accepted for older servers. The existing
`IndexConfigsManagedEmbeddingVector` type and JSON helpers retain their required
true flag and remain available. New code should prefer
`IndexConfigsNativeEmbeddingVector` and omit the flag. Servers predating the
simplified input reject it; use the explicit legacy flag with those deployments.
Explicit false cannot be combined with `embedding`.

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

Validated on `dev-aws-apne2-v3` at backend revision
`9072a1bc8925954369a887f558f1eaf387b7ea0e`: both embedding-only and legacy true
inputs passed create/update, normalized metadata, ordinary KNN, and Bayesian
retrieval in 4.72 seconds. Both temporary Collections were deleted and verified
absent. Lint, typecheck, declaration consumers, and all 186 unit tests passed.
