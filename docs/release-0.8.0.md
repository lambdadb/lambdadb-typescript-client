# TypeScript SDK 0.8.0 release preparation

Prepare the next stable package after `0.7.0`, directly from the validated dev
changes. Steven explicitly requested preparation without an RC. No `0.8.0` RC
feedback period is claimed. This preparation does not authorize or perform a
main merge, tag creation/push, GitHub Release publication, or npm publication.

The proposed tag is `v0.8.0`. Its target must be the reviewed release commit on
`main`; the GitHub Release must not be a prerelease, and its intended npm
dist-tag is `latest`. Follow [RELEASING.md](../RELEASING.md).

## Release notes

- Added top-level Bayesian hybrid search, two-signal helper types, and Bayesian
  scoring support for managed reranking. Typed subqueries prohibit nested rank
  fusion and explicit boosts through Boolean descendants. Free-form queries
  and server-side contract errors retain their existing behavior.
- Added explicit top-level `candidateSize` for Bayesian without rerank. The
  pinned server requires `1 <= size <= candidateSize <= 100`. With rerank, omit
  this field and use `rerank.candidateSize`, preserving its default. Existing
  text/KNN/RRF/Min-Max/L2 requests do not need or use the top-level field.
  Bayesian scores are heuristic fusion scores, not relevance probabilities.
- Added preferred native embedding-only vector configuration for create/update.
  The SDK does not insert `managedEmbedding` or model defaults. Existing explicit
  true inputs, legacy named types/helpers, and normalized server metadata remain
  supported. Public vector types reject mixed native/unmanaged fields at compile
  time, matching the existing runtime schema. Older servers require the true flag.
  Native dimensions/similarity belong inside `embedding`; explicit false with embedding remains invalid.
- Added automatic development previews from reviewed `develop` pushes with
  unique versions, source SHA metadata, required deployed smoke checks, and AWS
  OIDC authentication. Stable publishing remains an explicit GitHub Release.

See [Bayesian search](bayesian-search.md), [native embeddings](native-embeddings.md),
and the [changelog](../CHANGELOG.md). After publication:

```bash
npm install @functional-systems/lambdadb@0.8.0
```

## Source and deployment evidence

- Release branch starts at SDK develop `9f5ee314c216d68ea34b932459bdb40072c77290`.
  It includes merged [PR #37](https://github.com/lambdadb/lambdadb-typescript-client/pull/37)
  and [PR #38](https://github.com/lambdadb/lambdadb-typescript-client/pull/38).
- Bayesian/native input contract:
  `9072a1bc8925954369a887f558f1eaf387b7ea0e`. Other API contract pins are unchanged.
- [Deploy Dev run 37422611173](https://github.com/lambdadb/lambdadb/actions/runs/37422611173)
  succeeded for that exact backend SHA. Read-only ECS/ECR inspection on October 6,
  2026 confirmed Gateway and Query Executor task definition revision 16, image
  tag `dev-v3-9072a1b`, and running digests respectively:
  `sha256:300f65269579fcff327366490505327a549e38249c371e93df07f2ae0669bfef`
  and `sha256:bf87b32fdcbaf1b17f5cacb3ec8e9f1af1eb7ef51566d06cfb74273e3f857a54`.
- Live validation uses `dev-aws-apne2-v3` at
  `https://internal-dev-aws-apne2-v3-c05a2b5d492a.lambdadb.ai`, dedicated project
  `typescript-sdk-ci`. Its key is read from Secrets Manager only into process
  memory. No credential file or new infrastructure is created.

These development checks do not establish production deployment, relevance
quality, load handling, or complete provider billing/accounting correctness.

## Validation

- All seven version values, including the embedded User-Agent, match `0.8.0`.
- `npm ci`, `npm run lint`, `npm run typecheck`, and `npm test` passed: build,
  declaration consumers, and 198 executed runtime tests, no failures/skips.
- `npm run test:external:qdrant` passed four in-memory LangChain/LlamaIndex
  compatibility tests; these are separate from deployed-server tests.
- `npm pack --dry-run --json` and `npm pack --pack-destination /tmp/lambdadb-latest-compat/release080-review-pack --json`
  passed inspection: 919 files, 297800 bytes, no scratch logs/credential files.
  Prepared tarball SHA-1: `3bc496ef0b0c888f40ac0d1a26ddd17b0ec94f0b`.
- Clean tarball installation passed ESM/CommonJS imports, package/runtime version,
  Bayesian candidate serialization, and native/legacy configuration checks.
  Strict NodeNext `.mts` and `.cts` consumer compilation passed, including a
  negative nested-fusion case and native/unmanaged union conflicts in create/update,
  legacy inputs, and shared variables. The type-only review fix passed all 197
  runtime tests and declaration consumers. All 202 packed JavaScript files are
  byte-identical to the earlier live-validated build; live checks were not
  repeated for this declaration-only change. Earlier package evidence is retained
  separately, and the final tarball/consumers are under `release080-review-pack/`.
- `node --test test/integration/bayesian-live.test.mjs` passed in 77.17 seconds.
  It covered retrieval, separate candidate/output budgets, thirteen contract
  rejections, legacy fusion methods, and Query/QuerySafe reranking applied to
  three candidates, returning two results with preserved retrieval scores.
- `node --test test/integration/native-embedding-live.test.mjs` passed in 6.25
  seconds. Both preferred and legacy inputs passed SDK create/update, normalized
  metadata, actual OpenAI document/query embeddings, ordinary KNN without a
  top-level candidate budget, and Bayesian retrieval. All three Collections from
  these two suites were deleted and absence verified by HTTP 404.

- `npm run test:live:docs-url` passed in 50.50 seconds: all eight ordinary/Safe
  Query/Fetch/GET and POST List paths downloaded actual server arrays with content
  and header isolation checks. Its Collection was deleted and absence verified.
  Final project enumeration confirmed zero Collections. The persistent CI
  project/key remain for future validation.

Original logs, package manifests, tarball, and consumer fixtures are retained
outside the repository under `/tmp/lambdadb-latest-compat/`. They are preparation
artifacts; the publishing workflow rebuilds and validates the actual main tag.

The concurrency review fix groups automatic and explicit dev publications
together, with RC/stable tag groups unchanged. A focused regression evaluates
the actual workflow expression across push/dev/RC/stable events. Full checks
passed with 198 runtime tests, and
`go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.12 .github/workflows/publish.yaml`
passed. This workflow/test/documentation change does not alter the packed SDK
or perform a publication. Pending dev runs, including explicit dev Releases,
retain GitHub's replacement behavior as documented in [RELEASING.md](../RELEASING.md).

## Remaining publication steps

1. Complete required CI and automatic review for the final release PR head.
2. Review and merge the release PR into `main`.
3. Confirm feature availability in the intended consumer environment; only the
   development deployment above was inspected and tested.
4. Obtain explicit approval for `v0.8.0` tag creation/push, a non-prerelease
   GitHub Release, and resulting npm `latest` publication. Recheck that neither
   the npm version nor tag already exists, and use the exact reviewed main SHA.
5. Let the publishing workflow rerun required checks, AWS authentication, live
   docsUrl validation, and publish only its tested tarball. The tag-specific OIDC
   path has not been executed by this preparation.
6. Verify exact and unqualified registry installation, `latest=0.8.0`, integrity,
   and provenance. Synchronize the released changes back to `develop` through a
   reviewed PR; this will produce subsequent `0.8.0-dev.N` previews.

At preparation, npm has `latest=0.7.0`, `dev=0.7.0-dev.37433431398001`, and
`rc=0.5.0-rc.3`; neither npm `0.8.0` nor remote tag `v0.8.0` exists.
