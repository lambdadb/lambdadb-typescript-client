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
is 1–100 (default 10). `size: 0` at the query level requires at least one facet and
returns counts without documents. Omit `query` to match all documents.

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
- `npm test`: build, type tests, and all 110 runtime tests passed.
- `npm run lint` and `npm run typecheck` passed.
- Tests cover facet-only and downloaded documents through query/querySafe, omitted
  facets, default bucket configuration, Unicode values, and counts above 32 bits.
- No live API call or package publication was performed.
