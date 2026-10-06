# Bayesian hybrid search

Select Bayesian fusion explicitly with a top-level `bayesian` query. The contract
is pinned to backend [9072a1bc8925954369a887f558f1eaf387b7ea0e](https://github.com/lambdadb/lambdadb/commit/9072a1bc8925954369a887f558f1eaf387b7ea0e):
[BayesianQuery](https://github.com/lambdadb/lambdadb/blob/9072a1bc8925954369a887f558f1eaf387b7ea0e/api/src/main/java/ai/lambdadb/model/query/BayesianQuery.java)
and [two-signal validation](https://github.com/lambdadb/lambdadb/blob/9072a1bc8925954369a887f558f1eaf387b7ea0e/api/src/main/java/ai/lambdadb/model/query/RankableQueryBase.java).
This source pin does not establish deployment in another environment.

- Supply exactly two subqueries. Use `bool` to combine clauses within a signal.
- Explicit `boost`, including `1`, is unsupported on either child and on its Boolean descendants.
- Bayesian fusion is top-level only and requires no caller fusion weights.
- Without rerank, supply top-level `candidateSize` with `1 <= size <= candidateSize <= 100`.
  With rerank, omit top-level `candidateSize` and use `rerank.candidateSize`; its existing default remains unchanged.
- Calibration uses the retained retrieval candidates. Scores are heuristic fusion scores, not relevance probabilities.
- Existing RRF, Min-Max, L2 and request defaults remain unchanged. The SDK does not insert `size`, `knn.k`, or rerank candidate defaults.

The latest dev contract requires a candidate budget only for Bayesian retrieval
without rerank. Earlier Bayesian requests that omit it return HTTP 400. Ordinary
text/KNN and RRF/Min-Max/L2 requests retain their existing behavior and must not
set the top-level field. `candidateSize` controls candidates per signal; `size`
controls the final number of returned documents.

`BayesianQuery` and `BayesianSubquery` are optional TypeScript helpers exported
from the package root and `/models`. The existing free-form query input is
preserved: serialization passes the query unchanged, and the server validates
the fusion contract. The helper types enforce two signals and unboosted Boolean
descendants for typed callers; they do not replace server validation.

```typescript
import { LambdaDBClient, type BayesianQuery } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ projectApiKey: "<YOUR_PROJECT_API_KEY>" });
const query: BayesianQuery = {
  bayesian: [
    { queryString: { query: "body:restore" } },
    { knn: { field: "embedding", queryVector: [1, 0], k: 30 } },
  ],
};
const collection = client.collection("documents");
const retrieval = await collection.query({ query, size: 10, candidateSize: 30 });
const reranked = await collection.query({
  query,
  size: 10,
  rerank: {
    provider: "typesafe",
    model: "jev-1.13.0",
    queryText: "How do I restore a previous version?",
    fields: ["body"],
  },
});
console.log(retrieval.docs, reranked.rerank?.status);
```

Use the dimensions and field names configured on your Collection. For managed
embedding fields, use `knn.queryText` instead of `queryVector`.

Bayesian fusion precedes managed reranking. With reranking applied, `score` is
the final evaluation score and `retrievalScore` preserves the Bayesian score.
See [managed reranking](managed-reranking.md) for model and candidate constraints.

The candidate budget is distinct from final output `size`. Keeping the candidate
budget fixed preserves the ranking prefix when only output size changes on
unchanged data. The SDK serializes the supplied budget without choosing a default;
the server validates missing, invalid, and conflicting budgets. See the pinned
[QueryRequest](https://github.com/lambdadb/lambdadb/blob/9072a1bc8925954369a887f558f1eaf387b7ea0e/api/src/main/java/ai/lambdadb/dto/QueryRequest.java).

## Live validation

Load `LAMBDADB_BASE_URL`, `LAMBDADB_PROJECT_NAME`, and
`LAMBDADB_PROJECT_API_KEY` for the intended deployed environment and run:

```bash
npm run build
node --env-file=/path/to/private/.env.local --test test/integration/bayesian-live.test.mjs
```

Missing credentials fail the test. The smoke creates and deletes a temporary
Collection, checks default and consistent reads, fusion filters and budgets,
empty signals, server contract rejection, existing fusion methods, and applied
Bayesian + managed reranking through both Query and QuerySafe. The paid rerank
provider is accessed through LambdaDB only. Prepare and revoke project keys and
delete any temporary project through the authorized test-stack administration
workflow separately; never record credentials in validation evidence.

### Validation on 2026-10-06

Local validation passed: `npm ci`, `npm run lint`, `npm run typecheck`,
`npm test` (181 tests, zero failures or skips, including package-consumer type
checks), and `git diff --check`. `npm pack --dry-run` contained the new model
declarations in both module formats. An actual tarball was installed in a clean
directory; ESM import and CommonJS require both serialized Bayesian + rerank
requests successfully. No package version or publishing configuration changed.

The live smoke used a newly created temporary project and a separately issued
project API key against `steven-aws-apne2` at
`https://internal-steven-aws-apne2-bbd15c04e242.lambdadb.ai`.
The observed deployments were Gateway revision 5 and Query Executor revision
459, both `COMPLETED`. The supplied deployment source for this earlier validation was
`c49da19629d8fd3ce2144ead97b6f8e2b985c3bb`; running image digests were
`sha256:901c25ecf28c10a8ee7abb26c803515991a732d340ae9150cf67b7f0147b9a91`
(Gateway) and
`sha256:f1913000c27d9382ce1438d19ecca587feedfbd997edeabc0e88c6e69022c0fa`
(Query Executor). The image tags were `steven`, so this inspection alone does
not independently establish the source SHA.

`node --test test/integration/bayesian-live.test.mjs` passed Bayesian retrieval,
default/consistent-read equivalence, filters, result and vector budgets,
Boolean children, empty signals, seven HTTP 400 contract rejections, and the
existing RRF, Min-Max and L2 requests. The smoke then failed at the first
Bayesian + managed rerank call with HTTP 503. Server logs reported
`Rerank credential lookup failed; inspect secret configuration` and a rerank
stage with `reason: credentials`, three candidates and zero scored candidates.
At that time, the deployed Query Executor role granted secret reads only for
OpenAI, while its runtime named the TypeSafe secret. Applied reranking,
QuerySafe applied reranking, and the subsequent empty/null rerank cases were
unverified in this first attempt. That failure was not counted as a successful
smoke or a skip.

The temporary Collection was deleted and its absence verified by HTTP 404.
The issued project key was revoked (HTTP 200), the temporary project was deleted
(HTTP 200), and project absence was verified by HTTP 404. The local credential
file was removed. Non-secret scratch evidence remains outside the repository.
Test-stack IAM changes, deployment, and publication were not performed.

### Successful retest after the environment correction

After the test environment was corrected externally, the Query Executor's
existing IAM policy included `secretsmanager:GetSecretValue` for
`lambdadb/dev/typeSafeApiKey`. Gateway revision 5 and Query Executor revision 459
remained `COMPLETED`; this SDK task did not deploy or modify IAM.

A fresh temporary project and separately issued key were used to rerun
`node --test test/integration/bayesian-live.test.mjs`. The complete smoke passed
in 51.55 seconds: one test passed, zero failures and zero skips. All earlier
retrieval, default/consistent-read, filter, budget, Boolean, empty-signal,
server-validation and legacy-fusion checks passed again.

Both `collection.query()` and `collection.querySafe()` returned managed
reranking with `status: applied`, provider `typesafe`, model `jev-1.13.0`, three
candidates, three scored candidates, and two final documents. Final scores were
finite, within [0,1], and sorted descending. Each result's `retrievalScore`
exactly preserved its baseline Bayesian fusion score. Empty Bayesian candidates
returned rerank `status: skipped` with `reason: noCandidates`; explicit null
rerank preserved the Bayesian baseline.

The temporary Collection was deleted and its absence verified by HTTP 404.
The issued project key was revoked (HTTP 200), the temporary project was deleted
(HTTP 200), and project absence was verified by HTTP 404. The local credential
file was removed. No SDK publication or default promotion was performed.

### Latest develop deployment compatibility

The contract is now pinned to backend merge
`9072a1bc8925954369a887f558f1eaf387b7ea0e`, including the separate candidate/output
budgets. [Deploy Dev run 37422611173](https://github.com/lambdadb/lambdadb/actions/runs/37422611173)
succeeded for that exact SHA. The observed `dev-aws-apne2-v3` Gateway and Query
Executor task definitions were revision 16, with image tag `dev-v3-9072a1b` and
running digests `sha256:300f65269579fcff327366490505327a549e38249c371e93df07f2ae0669bfef`
and `sha256:bf87b32fdcbaf1b17f5cacb3ec8e9f1af1eb7ef51566d06cfb74273e3f857a54`,
respectively. Deployment run, tag, and running digest evidence were checked together.

The previous request without top-level `candidateSize` reproduced HTTP 400 on
this deployment. After adding explicit budget serialization, the complete live
smoke passed in 105.97 seconds. It covered thirteen server contract rejections,
fixed candidate budgets with varying output size, legacy fusion methods, and
applied Bayesian + rerank through Query and QuerySafe. Both rerank calls scored
all three candidates, returned two results, and preserved retrieval scores.
The docsUrl smoke also passed in 50.51 seconds.

The native embedding refactor in backend
`48f5251fb546d49c9055f496ea9a68a5c5122632` preserves the legacy public rerank shape
and `managedEmbedding: true` requests. A separate live compatibility probe
verified legacy embedding Collection creation, actual OpenAI document embedding,
and Bayesian `knn.queryText` through the SDK. The server's simplified
embedding-only request was accepted through raw HTTP, and the SDK parsed its
legacy-compatible Collection response. The SDK at that review point rejected the new request shape before HTTP.
This PR subsequently added [native embedding-only input](native-embeddings.md)
at the user's request, while retaining explicit legacy flags and named types.

All temporary Collections were deleted and absence verified. The dedicated
`typescript-sdk-ci` project and its Secrets Manager key remain for CI; no local
credential file was created. This validation did not deploy, publish, promote
fusion defaults, or change IAM.

Candidate-budget validation passed `npm ci`, `npm run lint`, `npm run typecheck`, and
`npm test` (183 tests, zero failures/skips). Clean tarball ESM/CommonJS consumers
serialized `candidateSize` successfully. After adding bounded cleanup retries
for HTTP 429/503, the complete live smoke passed again in 69.61 seconds and
verified Collection absence. An intermediate failed smoke's remaining Collection
was removed explicitly; final project enumeration confirmed no test Collections
remained. Original scratch evidence is retained outside the repository.

Native embedding-only support subsequently passed lint, typecheck, declaration
consumers, and all 186 unit tests. Its deployed SDK smoke passed in 4.72 seconds
for both new and legacy input, including ordinary KNN without `candidateSize`.
Both temporary Collections were deleted and their absence verified.
