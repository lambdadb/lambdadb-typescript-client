# TypeScript SDK 0.7.0 release preparation

This prepares the next stable package after `0.6.0`. The proposed tag is
`v0.7.0`, the GitHub Release must not be a prerelease, and the intended npm
dist-tag is `latest`. No tag, GitHub Release or npm publication is created by
this preparation.

The normal [release policy](../RELEASING.md#stable-releases) requires resolved
prerelease feedback. No `0.7.0` prerelease or external feedback period has taken
place. Publishing directly as stable would require an explicit exception in
addition to approval for main merge, tagging and publication. The prior `0.6.0`
exception does not authorize a new release.

## Draft release notes

- Added per-query server-managed reranking with `typesafe` / `jev-1.13.0`.
  Specify required query text and stored scalar text fields, and optionally
  supply 2–10 custom criteria ordered from low to high relevance. LambdaDB
  manages provider credentials; no Jev API key is required from SDK users.
- Applied reranking returns the final evaluation value in envelope `score`
  and preserves the original search value in envelope `retrievalScore`.
  Status metadata identifies applied, skipped and fallback results. Numeric
  zero, precision and server order are retained, including docsUrl downloads.
  Evaluation values are not relevance probabilities. Candidate cap, final
  response size and dense `knn.k` remain distinct; the SDK never rewrites `k`.
- Expanded fixed text analyzer presets from 16 to 49 names. Existing names,
  lowercase selection, omitted `standard` default and serialization are
  preserved. `keyword` is a text analyzer distinct from the keyword field
  type. Nepali/Tamil/Telugu are Lucene extensions, not common ES/OpenSearch
  support. Custom pipelines and analyzer options are not added.
- Qdrant payload schema objects now reject unsupported field options instead
  of silently discarding them. Callers passing `analyzers`, `tokenizer`,
  `lowercase` or other options must explicitly remove unsupported settings
  or use the native SDK for LambdaDB presets. Type-only mapping is unchanged.

Reranking retains existing facet query restrictions. `returnOriginal` only
handles eligible provider failures and does not mask validation, authorization,
retrieval, quota or admission errors. See [managed reranking](managed-reranking.md),
[analyzers](models/analyzer.md) and [Qdrant compatibility](compatibility/qdrant.md).

After publication, install the exact package with:

```bash
npm install @functional-systems/lambdadb@0.7.0
```

## Source provenance

- Release branch starts at SDK develop merge
  `f52d94cfa32f26eee4cbe9f4048ffa20716dbb4f` (PR #33).
- Analyzer SDK change: `f78dd7b219744ff96d0aaf42fa571ef47371f064` (PR #32).
- Analyzer backend: `55d888299fee44466326a9db8016af9811ade13b` (PR #437).
- Reranking backend: `a5e06d49be06d95dc5f4046aeecaf51f8a7733c0`, after
  feature PR #435 and Secret configuration PR #442. DTOs and design contract
  are linked in [managed reranking](managed-reranking.md).
- Public OpenAPI does not yet include reranking at pinned docs revision
  `961561c379acb079aec20191e13b89809ef096e9`; models follow the repository's
  documented manual maintenance procedure. Upstream reconciliation remains.
- Existing Data Versioning, facets and docsUrl contract pins remain unchanged.

Source revisions do not establish the deployed server commit. Live validation
uses the configured shared development endpoint
`https://internal-dev-aws-apne2-v3-c05a2b5d492a.lambdadb.ai`, project `bench-recall`,
with credentials loaded from `.env.local`. No production verification or
independent binary-to-source provenance is claimed.

## Local and package validation

- All seven version locations match `0.7.0`.
- `npm ci`, lint, typecheck, build and all 175 ordinary runtime tests passed.
- Four LangChain/LlamaIndex compatibility tests passed against their in-memory
  backend; these are separate from live API validation.
- Package dry-run and real pack completed: 910 files, both module formats,
  declarations, README and changelog; no environment files, logs or node_modules.
- A clean tarball installation passed ESM import, CommonJS require, package and
  runtime version checks, 49 analyzer exports, rerank serialization and strict
  NodeNext `.mts`/`.cts` consumers with nullable options.
- Packed artifact: `functional-systems-lambdadb-0.7.0.tgz`, 294807 bytes.
- SHA-1: `b51df6ab18aff7e03ff0211f3bb3d02aa6809057`.

Local validation artifacts are retained under
`/Users/steven/orca/artifacts/lambdadb-typescript-client/release-0.7.0/`.
The tarball is a tested preparation artifact. The publishing workflow rebuilds
from the approved main release commit and publishes only its tested tarball.

## Live validation

Checks ran on October 3, 2026 with the `0.7.0` build from SDK commit
`3180705` and the final smoke-test readiness/diagnostic changes in this PR.

| Check | Result |
| :-- | :-- |
| Required docsUrl smoke | Passed all eight ordinary/Safe Query, Fetch and GET/POST List paths with actual array downloads, hashes and header isolation. |
| Data Versioning | Passed lifecycle, reads, writes, branches, tags, aliases and bulk upload. |
| Qdrant live compatibility | Passed. |
| Keyword facets | Passed all 35 tests on an isolated rerun, including real docsUrl downloads. Initial concurrent run returned HTTP 503 before Collection creation. |
| Managed reranking | Passed default/null/custom 2/3/10 criteria, scores, order, retrievalScore, projection, metadata, empty candidates and legacy null behavior. |
| Expanded analyzers | **Blocked:** Collection creation returned HTTP 400. A separate `nepali` probe confirmed the endpoint still advertises only the original 16 analyzers. |

Reranking initially failed before any provider call because ordinary baseline
retrieval returned HTTP 503 immediately after creating a Collection. The final
test polls ordinary retrieval for at most 90 seconds, accepting only transient
404/503 errors or incomplete visibility. Baseline retrieval became ready on
the second attempt. Paid reranking requests are never retried. Initial
concurrent Collection-creation failures are retained in the evidence logs;
they are not counted as successful runs.

All successfully created temporary Collections were deleted and their absence
verified. Failed-create Collections and the unsupported-analyzer probe were
also confirmed absent. No test data or Collections remain from these checks.

Run the managed reranking smoke explicitly with the intended environment:

```bash
npm run build
node --env-file=.env.local --test test/integration/managed-reranking-live.test.mjs
```

The managed rerank smoke calls LambdaDB with five small synthetic-document
requests: default, explicit null and custom 2/3/10 criteria. It checks applied
scores, ordering, retrieval scores, projection and metadata plus empty and
legacy requests. It does not establish quality, load, failure-injection,
accounting or provider usage-event correctness.

## Publication gates

- Recheck npm versions and remote tags before publication. At preparation,
  `latest=0.6.0` and no npm `0.7.0` version was present.
- Deploy the 49-analyzer backend contract in the intended test environment and
  pass `test/integration/text-analyzers-live.test.mjs`. The current HTTP 400
  remains a publication blocker; SDK enum support does not change a server's
  allowlist. Re-run the required docsUrl smoke and applicable checks if the
  release candidate or target deployment changes.
- Resolve prerelease feedback or obtain an explicit direct-stable exception.
- Review and merge the release PR into main before tagging; verify the tag
  target is the reviewed main commit and version metadata is consistent.
- Approval must explicitly cover tag creation/push, stable GitHub Release
  publication and the resulting npm `latest` publication.
- Confirm feature availability in the intended consumer environment. Shared
  development smoke does not establish production deployment.
- Confirm approved effective-time input/output token rates and backend
  accounting readiness for customer reranking. Token events and SDK support
  alone do not establish correct customer settlement; no rate is invented here.
- After publication verify exact and unqualified installation, `latest=0.7.0`,
  package integrity and provenance. Do not move existing tags or reuse versions.
