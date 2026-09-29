# Keyword facets

This branch supports the keyword facet contract in:

- `lambdadb/lambdadb` commit `8da50bcd0b5a3c781ffccd7f01fb07ed0510dd30`,
  `api/src/main/java/ai/lambdadb/dto/QueryRequest.java`,
  `api/src/main/java/ai/lambdadb/model/query/FacetRequest.java`, and
  `api/src/main/java/ai/lambdadb/model/query/FacetResult.java`.
- `lambdadb/docs` commit `899092420ff801cfcb3b693b1ba273be7ac1f1ef`,
  `reference/api/openapi.json` and `guides/search/facets.mdx`.

These source commits do not establish deployment or package publication. Use a
server build containing the feature and rebuild existing data into a new collection.
Old keyword indexes and old Tags are unsupported; partial updates or segment merging
do not migrate their format. No version, package, or release is published by this change.

## Semantics

Request up to five keyword fields by name, including dotted paths. A field's `size`
is 1–100 (default 10 when omitted or null). `size: 0` at the query level requires at least one facet and
returns counts without documents. Omit `query` to match all documents.

The SDK rejects more than five requested facet fields and `size: 0` without a
facet before making a network request. `query` throws `SDKValidationError` for
these inputs; `querySafe` returns it as an error Result.

Counts include all documents matching the query and partition filter within the
selected ref, independent of the returned document count. Each distinct indexed
array value contributes once per document. Missing or unindexed values produce no
bucket. Results are ordered by count descending, then Unicode code point order.
`total` still counts returned documents. Facets remain available after `docsUrl`
document downloads. Without a facet request, existing responses may omit facets.

Use queryString, bool combinations of supported queries, or no query. Vector,
sparse-vector, hybrid, numeric/date range facets, and excluding a facet's own filter
are outside this contract. Existing ref and consistentRead constraints still apply.
At more than 10,000 distinct (field, value) buckets or 262,144 UTF-8 bytes of distinct
values across fields, the server returns HTTP 400 instead of partial counts.

Keyword array sorting uses the smallest indexed value ascending and largest
descending. Missing values sort last ascending and first descending.

## Example

```typescript
import { LambdaDBClient, type FacetResult } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ baseUrl: "YOUR_BASE_URL",
  projectName: "YOUR_PROJECT_NAME", projectApiKey: "YOUR_API_KEY" });
const result = await client.collection("items").query({
  size: 0, facets: { tags: { size: 5 } },
});
const tags: FacetResult | undefined = result.facets?.tags;
for (const bucket of tags?.buckets ?? []) console.log(bucket.value, bucket.count);
```

`querySafe` supports the same input. FacetRequest, FacetBucket, and FacetResult are
exported as public types. Counts use JavaScript Number, so integers above
`Number.MAX_SAFE_INTEGER` cannot be represented exactly by this SDK.

## Review and validation

- [Request/response types and schemas](../src/models/operations/querycollection.ts),
  [public exports](../src/types/public.ts), and [wire tests](../test/facets.test.mjs).
- `npm test`: build, type tests (including `test/types/facets.ts`), and all 114 runtime tests passed.
- `npm run lint` and `npm run typecheck` passed.
- Tests cover facet-only and downloaded documents through query/querySafe, omitted
  facets, omitted/null bucket sizes, the five-field boundary, local rejection of
  invalid requests, Unicode values, and counts above 32 bits.
- No package publication was performed.

The credentialed [facet smoke test](../test/integration/facets-live.test.mjs)
creates fresh indexes, checks query/querySafe with consistent and committed reads,
and deletes its temporary Collection with a follow-up 404 check. Missing environment
variables fail the test instead of silently skipping it. Run it against the intended
deployment after building the SDK:

```bash
npm run build
node --env-file=/absolute/path/to/.env.local \
  --test test/integration/facets-live.test.mjs
```

### Live validation on 2026-09-29

The initial run below found a score response mismatch. The later
[retest after the server fix](#live-retest-after-the-server-fix) passed the same
34 scenarios without SDK or test changes.

- SDK/test revision: `e4b3ecb0c6cc591fe65e409d008b2abb4865711d`.
- Environment: `https://internal-dev-aws-apne2-v3-c05a2b5d492a.lambdadb.ai`,
  project `bench-recall`, using the original checkout's `.env.local`.
- This validates observed endpoint behavior; the deployed backend commit was not
  independently established. The pinned source contracts above remain unchanged.
- Result: **22 of 34 child scenarios passed; 12 failed**. Node also counts the
  failing parent test, reporting 35 tests, 22 passed, and 13 failed. No tests skipped.
- Passed with both `query` and `querySafe`, and both `consistentRead` modes:
  facet-only omitted/null size defaults (10 of 12 categories), array deduplication,
  Unicode buckets, logical partition filtering on two values sharing one physical
  partition, query filtering, dotted field names, and empty buckets.
- Both ordinary and Safe queries successfully downloaded real 6 MiB document
  results from `docsUrl`. The test verified JSON-array downloads, payload hashes,
  unchanged facet buckets, and absence of API credentials on transfer requests.
- Every failed case omitted `query` and requested one document: facet top-bucket
  limits, partition-filtered document results, or a request without facets. The
  server returned HTTP 200 with `maxScore: "NaN"` and `docs[0].score: "NaN"`.
  These strings fail the numeric response schema as `ResponseValidationError`.
  The behavior occurs with both `consistentRead` values and both SDK methods.
  The initial smoke failed on this response-contract mismatch; it did not
  normalize the strings or suppress these scenarios.
- Cleanup: `ts-facets-6d95e758-4e4a-4777-b549-7c7dfc030e0c` was deleted and a
  subsequent GET returned 404. Earlier diagnostic Collections were also deleted
  and checked for absence.

Initial failure reproduction against a Collection containing at least one matching
document (replace `tags` with an indexed keyword field):

```typescript
await collection.query({
  size: 1,
  fields: { include: ["id"] },
  facets: { tags: { size: 1 } },
}); // Before the server fix: ResponseValidationError for string scores ("NaN").
```

### Live retest after the server fix

- Retested on 2026-09-29 at approximately 09:18 UTC against the same development
  endpoint and `bench-recall` project after the user reported deploying the fix.
- SDK checkout: `fede7ac6e3ed49de4034f6ea8bab3fb128329085`, rebuilt with
  `npm run build`. The SDK implementation and live test are unchanged from the
  initial run at `e4b3ecb0c6cc591fe65e409d008b2abb4865711d`.
- Result: **all 34 child scenarios passed**, including all 12 previously failing
  query-less document cases. Node reports 35 passed (including the parent test),
  0 failed, 0 skipped; total duration approximately 65 seconds.
- Both `query` and `querySafe` passed with `consistentRead: true` and `false`.
  Document limits, partition-filtered documents, and responses without facets now
  parse successfully with the existing numeric score schema.
- Both real 6 MiB `docsUrl` downloads passed again, including payload hashes,
  facet preservation, and API-header isolation.
- Cleanup: `ts-facets-c64fec20-ab6e-4dab-9b26-c7a33faffb07` was deleted and a
  subsequent GET returned 404.
- These are observed deployed behaviors; the exact deployed backend revision was
  not independently established. No SDK workaround or test suppression was added.

The targeted live regression now passes. This is not a full release validation:
third-party integrations and a registry package installation were not tested,
and no package was published.
