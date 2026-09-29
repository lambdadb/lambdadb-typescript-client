# TypeScript SDK 0.6.0-rc.1 release preparation

This is a prepared release candidate, not a published package. The proposed tag
is `v0.6.0-rc.1`, the GitHub Release must be a prerelease, and the intended npm
dist-tag is `rc`. Publishing must leave `latest=0.5.1` unchanged.

## Draft release notes

This candidate adds keyword facets and expands text analyzer support from four
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

After publication, users can opt in with:

```bash
npm install @functional-systems/lambdadb@0.6.0-rc.1
```

See [keyword facets](keyword-facets.md), [analyzers](models/analyzer.md), and the
[changelog](../CHANGELOG.md) for details.

## Source identity

- Release implementation/metadata commit: `9a0f00813a1ed806c348e8ddcfea9a36aec34e1b`.
- Analyzer smoke/docs follow-up: `ddb1d7f960e1e77fd492a8a68f18fa3fe4c4fd22`.
  SDK runtime source is unchanged from the release implementation commit.
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
  version locations match `0.6.0-rc.1`.
- `npm ci`, lint, typecheck, build, and 114 runtime tests passed, including the
  facet type tests. The four LangChain/LlamaIndex compatibility tests passed
  against their in-memory backend; they are distinct from live API validation.
- `npm pack --dry-run` and the real pack completed. The manifest contains 901
  files, both ESM/CommonJS builds and declarations, README, and changelog;
  no environment files, logs, or node_modules are included.
- Installing the tarball into a clean directory passed ESM import, CommonJS
  require, package/runtime version checks, and strict NodeNext `.mts`/`.cts`
  consumers of the facet public types, including nullable bucket size.
- Tarball: `functional-systems-lambdadb-0.6.0-rc.1.tgz`, 288017 bytes.
- SHA-1: `a8b68e495a65a2ff65c50aca479d54eb4904380f`.
- Integrity: `sha512-nycCQ+38WudRRxxVB/PgnjyVVnvsFI010jqH6Ac9+tEzQ/3+vG3NLkepJV5+xwm6fMEiMPk0yLIE5dXgIrGqSw==`.

## Live validation on 2026-09-29

The release-version SDK passed all applicable live checks against the development
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

## Publication gates

- At preparation time npm has no `0.6.0-rc.1`, and GitHub has no
  `v0.6.0-rc.1` tag. Recheck before publishing to avoid identity reuse.
- The release PR must be reviewed and merged into `main` before tagging.
  The package publisher verifies that the tagged commit belongs to `main`.
- The main merge is left for review and approval. Tag creation/push, GitHub
  prerelease publication, and resulting npm publication require explicit approval
  under [RELEASING.md](../RELEASING.md).
- A published GitHub prerelease starts the existing trusted-publishing workflow;
  it publishes the tested tarball with npm `rc` and provenance.
- After publication verify exact-version installation, `rc=0.6.0-rc.1`, and
  unchanged `latest=0.5.1`. No tag or publication has been performed by this
  preparation.
