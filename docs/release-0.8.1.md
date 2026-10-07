# TypeScript SDK 0.8.1 release preparation

Prepare a stable patch after `0.8.0`, directly from the reviewed terminology
cleanup in [PR #41](https://github.com/lambdadb/lambdadb-typescript-client/pull/41).
The requested release path skips an RC; no RC feedback period is claimed.
The release branch starts at develop `c7a4822003aca7015f0377f1077107ef7a043295`
and targets `main`.

The intended tag is `v0.8.1`, the GitHub Release must not be a prerelease, and
the npm dist-tag is `latest`. Preparation does not create a tag or publish a
release. Follow [RELEASING.md](../RELEASING.md).

## Release notes

- Standardized feature terminology as native embedding and native reranking in
  documentation, examples, SDK comments, and internal test names.
- Moved the [native reranking guide](native-reranking.md) to its canonical path.
  The previous URL and section anchors remain available as compatibility links.
- Preserved public symbols, wire fields such as `managedEmbedding`, configuration
  keys, exact legacy error strings, and legacy behavior tests. API behavior,
  validation order, serialization, defaults, limits, and dependencies are unchanged.

After publication:

```bash
npm install @functional-systems/lambdadb@0.8.1
```

## API contract and environment

No API contract changes are introduced. Existing exact source pins remain:

- Native embedding and Bayesian query input:
  `9072a1bc8925954369a887f558f1eaf387b7ea0e`.
- Native reranking: `a5e06d49be06d95dc5f4046aeecaf51f8a7733c0`.
- Other contract pins remain as documented in [OpenAPI maintenance](OPENAPI_UPDATE.md).

The intended smoke environment is `dev-aws-apne2-v3`, endpoint
`https://internal-dev-aws-apne2-v3-c05a2b5d492a.lambdadb.ai`, with dedicated
project `typescript-sdk-ci`. The source pins above do not establish the currently
deployed backend revision or production availability.

## Preparation validation

- All seven version values, including SDK metadata and User-Agent, are `0.8.1`.
  Package and lockfile configuration is otherwise unchanged.
- `npm ci`, `npm run lint`, `npm run typecheck`, and `npm test` passed on Node
  24.15.0 / npm 11.12.1. The test command builds both module formats, compiles
  package-consumer type tests, and executes 198 tests with zero failures/skips.
- `npm run test:external:qdrant` passed all four in-memory LangChain/LlamaIndex
  compatibility tests. These do not exercise a deployed server.
- `npm pack --dry-run --json` and actual tarball creation passed: 919 files,
  297936 bytes, SHA-1 `fcaf1504168632c2dc059ba42e33b51139680cf4`.
- Clean tarball installation passed ESM import, CommonJS require, and package
  version checks. All 202 packed JavaScript files match published `0.8.0` after
  excluding comments and normalizing the intended SDK version update.
- No credentials, scratch logs, tests, or node_modules are included in the package.
- Dependency installation reports 11 existing high-severity vulnerabilities;
  dependency versions were not changed by this patch.

Local package evidence is retained outside the repository under
`/tmp/lambdadb-release081/`. The publication workflow rebuilds and validates its
own exact reviewed main tag; this preparation tarball is not published.

## Publication gates

1. Complete CI and automatic review for the latest release PR head, then review
   and merge the release PR into `main`.
2. Complete the required docsUrl live smoke on the release candidate checkout.
   Local AWS SSO authentication was expired during initial preparation; no local
   candidate smoke success or fresh backend deployment inspection is claimed.
   The independently triggered develop publication run is
   [37586041285](https://github.com/lambdadb/lambdadb-typescript-client/actions/runs/37586041285).
   Its results concern the merged develop commit, not the `0.8.1` candidate.
3. Obtain explicit approval for the `v0.8.1` tag, non-prerelease GitHub Release,
   and resulting npm `latest` publication. Recheck that the version/tag do not
   exist and use the exact reviewed commit on `main`.
4. Let the publishing workflow rerun all release checks, including deployed
   docsUrl downloads and verified Collection cleanup, before publishing its tarball.
5. Verify exact and unqualified installation, `latest=0.8.1`, package integrity,
   and provenance. Synchronize the release back to `develop` through a reviewed PR.

At the initial registry check on October 7, 2026, `latest` was `0.8.0`,
`dev` was `0.8.0-dev.37451354699001`, and `rc` was `0.5.0-rc.3`.
Neither npm version `0.8.1` nor remote tag `v0.8.1` existed.
