# TypeScript SDK 0.6.0 release preparation

This prepares a direct stable release, not a published package. The proposed tag
is `v0.6.0`, the GitHub Release must not be a prerelease, and the intended npm
dist-tag is `latest` (currently `0.5.1`).

The user asked to consider stable publication instead of RC1. There is no
technical prerequisite for an RC tag in the publishing workflow. The usual
[release policy](../RELEASING.md#stable-releases) calls for resolving prerelease
feedback first, so the direct-stable exception is explicitly part of the final
publication approval. No `0.6.0-rc.1` was published and no external RC feedback
period has occurred. Existing validation evidence is recorded below.

## Draft release notes

This release adds keyword facets and expands text analyzer support from four
to sixteen names.

- Request keyword counts through `collection.query` and `querySafe`, including
  arrays and dotted field paths. Public types include `FacetRequest`,
  `FacetBucket`, and `FacetResult`.
- Use query-level `size: 0` for facet-only results, and omit `query` to match all
  documents. Facet metadata is retained after automatic `docsUrl` downloads.
- Request up to five fields and 1–100 buckets per field. Omitted or null bucket
  size uses the server default of 10. Invalid field counts and facet-less
  `size: 0` requests fail locally.
- Added analyzers: `chinese`, `cjk`, `arabic`, `french`, `german`, `hindi`,
  `indonesian`, `italian`, `portuguese`, `russian`, `spanish`, and `turkish`.
  Omission, empty arrays, ordering, and existing names retain their behavior.
  The server rejects duplicate names with HTTP 400; the SDK preserves caller
  input without silently deduplicating it.

Facets require a supporting server deployment and newly built keyword indexes.
Reinsert existing data into a new Collection; partial updates, segment merging,
and old Tags do not migrate the format. Counts use JavaScript Number, so integers
above `Number.MAX_SAFE_INTEGER` are not all represented exactly.

After publication, install this exact version with:

```bash
npm install @functional-systems/lambdadb@0.6.0
```

See [keyword facets](keyword-facets.md), [analyzers](models/analyzer.md), and the
[changelog](../CHANGELOG.md) for details.

## Source identity

- Stable metadata/build commit: `04f87e11e53427856f185595e0668e1926113fe0`.
- Initial release implementation: `9a0f00813a1ed806c348e8ddcfea9a36aec34e1b`.
- Analyzer smoke/docs follow-up: `ddb1d7f960e1e77fd492a8a68f18fa3fe4c4fd22`.
  The stable switch changes only the version and User-Agent in SDK runtime
  source; feature implementation and live test logic are unchanged.
- Base: `develop` at `4b19c344e3ebbefd242932678ea85759d1727f0c` after PR #29.
  It also includes the unreleased analyzer work from PR #28.
- Existing general API contract: docs `c44180406c05b1a9043d8516e7c7f60df91fc9a7`.
- Analyzer contract: docs `3bda642f2e7f4f26432f1dfdcb076f656d50f873`,
  backend `410154abcdf5275add1df47dcf23c170ed0e0efd`.
- Facet contract: docs `899092420ff801cfcb3b693b1ba273be7ac1f1ef`,
  backend `8da50bcd0b5a3c781ffccd7f01fb07ed0510dd30`.
- Duplicate analyzer validation: backend
  `335cb16fcef5d7b8d60f88c84f2ce2cf87f96939`, `Validation.validateTextType`.

Source revisions do not establish the deployed backend revision. Live checks
use `https://internal-dev-aws-apne2-v3-c05a2b5d492a.lambdadb.ai`, project
`bench-recall`, with credentials loaded from the original checkout's `.env.local`.
The exact deployed server commit is not independently established.

## Local and package validation

- All seven package, lockfile, JSR, example-lock, SDK metadata, and User-Agent
  version locations match `0.6.0`.
- `npm ci`, lint, typecheck, build, and 114 runtime tests passed, including the
  facet type tests. The four LangChain/LlamaIndex compatibility tests passed
  against their in-memory backend; they are distinct from live API validation.
- `npm pack --dry-run` and the real pack completed. The manifest contains 901
  files, both ESM/CommonJS builds and declarations, README, and changelog;
  no environment files, logs, or node_modules are included.
- Installing the tarball into a clean directory passed ESM import, CommonJS
  require, package/runtime version checks, and strict NodeNext `.mts`/`.cts`
  consumers of the facet public types, including nullable bucket size.
- Tarball: `functional-systems-lambdadb-0.6.0.tgz`, 287975 bytes.
- SHA-1: `e324189ca8c32d0e6d1fdd06038cf4bdc2a5e9dd`.
- Integrity: `sha512-qAtC0doBqRujyTxgYd1fxo8kFxef7TdrvBLklIUM0l36gzRPN4q/xUPbL7tBKGWfx31mWat/e/qwOay2N4bUqQ==`.

## Earlier live validation on 2026-09-29

The preceding `0.6.0-rc.1` build passed all applicable live checks against the development
endpoint above. The initial combined run reported 38 passed and 1 failed because
its older analyzer fixture expected the server to accept duplicates. That failure
was investigated, not skipped: the endpoint returned `Duplicate analyzer: cjk`,
matching the additional validation in backend source `335cb16f...`.

The analyzer smoke was updated to preserve unique list order and explicitly
assert HTTP 400 on a duplicate-analyzer Collection update. Its rerun passed.
The SDK still forwards the caller's analyzer list unchanged; no runtime
normalization or schema relaxation was introduced.

| Check | Result |
| :-- | :-- |
| Keyword facets | All 34 child scenarios passed; query/querySafe, both consistentRead modes, filters, defaults/null, and real docsUrl downloads |
| docsUrl release smoke | All eight Query/Fetch/GET List/POST List ordinary and Safe paths passed, including payload hashes and credential isolation |
| Data Versioning | Lifecycle, Branch/Tag/Alias reads, writes, pagination, signed bulk upload, and cleanup passed |
| Qdrant live compatibility | Vector operations, filters, committed scrolling, and cleanup passed |
| Text analyzers after fixture alignment | All 16 analyzers, positive/negative searches, defaults, empty/ordered lists, Chinese/CJK distinctions, and duplicate rejection passed |

Successful test Collections were deleted and absence was verified. The two
rejected analyzer-create attempts were also checked with GET and returned 404.
The final analyzer Collection was
`ts-analyzers-f864c9c4-1f33-4067-acf7-2d2b85bcdba5`; the facets Collection was
`ts-facets-2936cc3d-ae37-443c-85b7-84a0223b9913`; the docsUrl Collection was
`ts-offload-58f1ac7b-36b6-4edf-8d48-3f02c30acb7c`.

These results are not production-environment validation. All publication gates
below remain separate from local and live checks.

## Stable-build live validation on 2026-09-29

The stable `0.6.0` build at `04f87e11e53427856f185595e0668e1926113fe0`
was retested against the same development endpoint after rebuilding and completing
all local, external compatibility, and packed-consumer checks.

- Facets: all 34 child scenarios passed with ordinary/Safe methods and both
  consistentRead modes, including the previously failing query-less document
  results and actual docsUrl downloads.
- Required docsUrl release smoke: all eight ordinary/Safe Query, Fetch, GET List,
  and POST List paths passed, with full content hashes and API-header isolation.
- Node result: 36 passed (34 child scenarios plus the two parent tests), zero
  failures or skips; approximately 90 seconds.
- Cleanup: `ts-facets-8378a249-3f4a-4b4d-88c7-bf7dcd55ec63` and
  `ts-offload-33339be2-5db8-4b9b-b583-b74249ac7658` were deleted; follow-up GETs
  verified absence.
- Data Versioning, Qdrant live, and analyzer evidence remains the earlier same-day
  run above. Those tests and feature implementation did not change during the
  stable switch; only version metadata and release documentation changed.

## Publication gates

- At preparation time npm has no `0.6.0`, and GitHub has no `v0.6.0` tag.
  Recheck before publishing to avoid identity reuse.
- The release PR must be reviewed and merged into `main` before tagging.
  The publisher verifies that the tagged commit belongs to `main`.
- Approval must cover the direct-stable exception described above, main merge,
  tag creation/push, stable GitHub Release publication, and the resulting npm
  `latest` publication. Tagging and publication require explicit approval under
  [RELEASING.md](../RELEASING.md).
- A published stable GitHub Release starts the existing trusted-publishing
  workflow; it publishes the tested tarball with npm `latest` and provenance.
- After publication verify exact-version and unqualified installation,
  `latest=0.6.0`, package integrity, and provenance. No tag or publication has
  been performed by this preparation.
