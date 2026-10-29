# Releasing the TypeScript SDK

This document defines the required packaging and release process for the
`@functional-systems/lambdadb` npm package.

npm is the production distribution channel. A push to `develop` starts automatic
dev publication. A published GitHub Release starts explicit dev, RC, or stable
publication. The repository also contains `jsr.json`, but the
current workflow does not publish to JSR.

## Branches and merges

`develop` is the integration branch. `main` is the default branch and receives
releases through promotion pull requests.

1. Branch feature and fix work from the current `develop` and open a pull
   request targeting `develop`. Select the base explicitly; GitHub defaults to
   `main`. Merge it with **Squash and merge**.
2. Cut `release/X.Y.Z` from the reviewed `develop` commit. Land release
   preparation (version sources, `CHANGELOG.md`, release notes) and any RC fixes
   on it through pull requests into the release branch. `develop` keeps
   receiving feature work; nothing merged into `develop` after the cut ships in
   this release. When there is nothing to stabilize, the release branch may be
   skipped and `develop` promoted directly.
3. Promote with a `release/X.Y.Z` -> `main` pull request (or `develop` -> `main`
   when the release branch is skipped) merged with **Create a merge commit**. Tag
   and publish from the resulting reviewed `main` merge commit. Each RC repeats
   this: fix on the release branch, promote, and tag the next `-rc.N`.
4. After every promotion and tag, back-merge with a `main` -> `develop` pull
   request merged with **Create a merge commit**. Back-merge `main`, not the
   release branch: only `main` carries the promotion merge commit and its tag,
   plus any hotfix or Dependabot change merged straight into `main`. Never
   squash or rebase a back-merge pull request: that makes the trees equal
   without ancestry, so later comparisons repeat merged commits and release tags
   become unreachable from `develop`. Afterwards,
   `git merge-base --is-ancestor origin/main origin/develop` must succeed.
   Resolve conflicts in the back-merge pull request, typically keeping
   `develop`'s newer content.
5. For a hotfix, cut `hotfix/X.Y.Z` from `main`, open a pull request into `main`
   (merge commit), tag and publish, and then back-merge `main` -> `develop` as in
   step 4.
6. Delete `release/*` and `hotfix/*` branches after their promotion pull request
   merges.

After lambdadb/lambdadb-iac#22 is applied, organization rulesets enforce the
`develop` and `main` rules: deletion and force pushes are blocked and changes
require a pull request. `develop` allows squash and merge commits but not
rebase merges; `main` allows merge commits only. There are no bypass actors.
Tags and `release/*` and `hotfix/*` branches are not covered.

Ordinary CI runs only for pushes to, and pull requests targeting, `develop` and
`main`. For pull requests into a release or hotfix branch, run `npm run lint`,
`npm run typecheck`, and `npm test` locally. The Release verification workflow
runs on every `main` push, including each promotion merge.

## Version sources

Every build must use the same canonical SemVer version in all four locations:

- `version` in `package.json`
- top-level `version` in `package-lock.json`
- root package version at `packages[""]` in `package-lock.json`
- `version` in `jsr.json`

The local package entry at `packages[".."].version` in
`examples/package-lock.json` and both the `sdkVersion` and embedded User-Agent
version in `src/lib/config.ts` must match those four version sources.

Explicit release tags add a leading `v` to the same package version. Automatic
dev packages have no Git tag or GitHub Release.

| Channel | Package version | Git tag | npm dist-tag | Source branch |
| :-- | :-- | :-- | :-- | :-- |
| Development | `X.Y.Z-dev.N` | None for automatic; `vX.Y.Z-dev.N` for explicit | `dev` | `develop` |
| Release candidate | `X.Y.Z-rc.N` | `vX.Y.Z-rc.N` | `rc` | `main` |
| Stable | `X.Y.Z` | `vX.Y.Z` | `latest` | `main` |

Use a unique version for every publication. npm does not allow replacing an
existing package version.

## npm selection behavior

The unqualified install command resolves the npm `latest` dist-tag:

```bash
npm install @functional-systems/lambdadb
```

Publishing a development package with `--tag dev` or an RC with `--tag rc`
does not change `latest`. Consumers can explicitly opt in with a dist-tag or an
exact version:

```bash
npm install @functional-systems/lambdadb@dev
npm install @functional-systems/lambdadb@rc
npm install @functional-systems/lambdadb@0.5.0-rc.1
```

All packages published to the public npm registry remain publicly installable.
Use a GitHub Actions artifact instead of npm if a build must remain internal.

## Preparing a version

For an explicit RC or stable release, create the release version through a
reviewed pull request into `release/X.Y.Z`, `hotfix/X.Y.Z`, or `develop` when
the release branch is skipped. An explicit dev release uses a reviewed pull
request into `develop`. Automatic dev publication generates its version in CI
instead. For example:

```bash
npm version 0.5.0-dev.1 --no-git-tag-version
```

Then update `version` in `jsr.json` to the same value. Confirm all sources:

```bash
node -e '
const p = require("./package.json");
const l = require("./package-lock.json");
const e = require("./examples/package-lock.json");
const j = require("./jsr.json");
console.log(
  p.version,
  l.version,
  l.packages[""].version,
  j.version,
  e.packages[".."].version,
);
'
```

Also update `SDK_METADATA.sdkVersion` and the embedded version in
`SDK_METADATA.userAgent` in `src/lib/config.ts`. The publish workflow and test
suite reject a mismatch.

Commit the version update before creating an explicit release tag. For tagged
releases, the publish workflow validates committed versions without rewriting
them. For automatic dev packages, it first checks that committed versions agree,
then updates every version source in the disposable checkout.

## Development packages

Reviewed pushes to `develop` publish automatically after lint, typechecking,
tests, clean tarball installation, and deployed live smoke tests against the
dev environment pass. A merge into `main` is not required. Protect `develop` so
only reviewed changes reach this publication trigger; merging into it authorizes
automatic dev publication under this policy.

The workflow checks out the exact push SHA and generates `X.Y.Z-dev.N`, where
`X.Y.Z` is the committed package version's core and `N` is
`GITHUB_RUN_ID * 1000 + GITHUB_RUN_ATTEMPT`. Maintainers control the core version
through reviewed changes. Each rerun gets a new immutable version. The workflow
updates package and lockfile versions, `jsr.json`, SDK metadata, and User-Agent
only in its disposable checkout. It creates no version commit, Git tag, or
GitHub Release. The published `package.json` includes `lambdadbSourceCommit`.

Automatic pushes and explicit dev Releases share one concurrency group, so dev
publications cannot overlap. RC/stable releases retain their tag-specific groups.
Immediately before automatic publication, the workflow
fetches `develop` and skips a commit that is no longer its head.
[GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
may replace a pending run with a newer push; not every intermediate commit is
published. This pending-run replacement also applies to an explicit dev Release;
if it is canceled before publication, rerun its workflow when that selected
version is still needed and remains unpublished. The `dev` dist-tag points to
the latest successfully published build. Failed validation leaves the previously
published dev version in place.
The exact tarball and npm pack manifest are retained as workflow artifacts.

An explicit dev GitHub Release remains supported when a manually selected
version is needed: align all committed version sources, complete validation,
merge into `develop`, obtain publication approval, tag that exact commit, and
publish a GitHub prerelease. Explicit RC and stable releases still use `main`.
Never reuse a published version or move its tag.

## Release candidates

Release candidates use a version such as `0.5.0-rc.1`. Set the RC version on
`release/X.Y.Z`, complete validation, and promote the release branch to `main`
with a pull request merged with **Create a merge commit**. Wait for the Release
verification workflow to pass on the resulting `main` merge commit before
tagging it.
Mark the GitHub Release as a prerelease; the workflow publishes it with npm
dist-tag `rc`.

Verify the candidate explicitly:

```bash
npm view @functional-systems/lambdadb@rc version
npm install @functional-systems/lambdadb@0.5.0-rc.1
```

After each RC is tagged, back-merge `main` -> `develop` as described in
[Branches and merges](#branches-and-merges). Address feedback with fixes on
`release/X.Y.Z`, increment the RC number, and promote again.

## Stable releases

Publish the matching stable version only after prerelease feedback is resolved.

1. On `release/X.Y.Z` (or `develop` when the release branch is skipped), set
   all version sources to the stable version, such as `0.5.0`, through a
   reviewed pull request.
2. Update release notes and user-facing documentation.
3. Run the complete validation checklist.
4. Promote `release/X.Y.Z` (or `develop`) to `main` with a pull request merged
   with **Create a merge commit**.
5. Wait for the Release verification workflow to pass on the resulting `main`
   merge commit.
6. Tag that exact commit as `v0.5.0`.
7. Create a GitHub Release that is not marked as a prerelease.
8. Wait for the workflow to publish with npm dist-tag `latest`.
9. Verify a clean installation and the registry dist-tags.
10. Back-merge `main` -> `develop` with a merge-commit pull request and delete
    the release branch.

## Validation checklist

Before publishing any development, RC, or stable package:

- Confirm the source checkout is the exact reviewed commit on `develop` for
  dev or `main` for RC/stable. Explicit tagged releases require a clean working
  tree and matching tag target. Automatic dev builds may modify only generated
  version metadata in the disposable checkout.
- Pin and record the API contract revision used for implementation.
- Confirm the target API is deployed in the intended test environment.
- Confirm all version locations agree and any explicit release tag matches.
- Confirm the version uses the supported canonical SemVer form.
- Run `npm ci`.
- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm test`.
- Build and inspect the package with `npm pack --dry-run`.
- Install the generated tarball in a clean directory.
- Verify both ESM `import` and CommonJS `require` from that installation.
- Complete applicable live and third-party integration smoke tests.
- Run `npm run test:live` against the intended deployed endpoint before every
  publication: the dev environment for dev packages and production for RC and
  stable packages. This runs every `test/integration/*-live.test.mjs` file one
  at a time; concurrent bulk writes can exceed writer capacity and return HTTP
  429. Each file creates its own temporary Collections and verifies their
  deletion. The
  docsUrl test requires real `docsUrl` array downloads; an inline-only response
  is a failure. Missing environment variables are a failure, not a skipped check.
  Record the environment, SDK commit, observed behavior, and cleanup result;
  source revision alone does not establish the deployed server revision.
- For explicit releases, review release notes before publishing the GitHub Release.

The live tests read `LAMBDADB_BASE_URL`, `LAMBDADB_PROJECT_NAME`, and
`LAMBDADB_PROJECT_API_KEY` from the environment or `.env.local`. Use a project
where temporary test Collections may be created and deleted. For a worktree
without its own environment file, load the original checkout's file explicitly:

```bash
npm run build
LAMBDADB_RUN_LIVE_TESTS=1 node --env-file=/absolute/path/to/original-checkout/.env.local \
  --test --test-concurrency=1 test/integration/*-live.test.mjs
```

This credentialed test is separate from the ordinary PR CI. Missing credentials
or an untested deployed endpoint must not be reported as successful live
validation. Do not record API keys or signed download URLs in release evidence.

After publication, verify the registry without relying only on the workflow
status:

```bash
npm view @functional-systems/lambdadb dist-tags --json
npm view @functional-systems/lambdadb@0.5.0-rc.1 version
```

For a prerelease, the first command must show the existing stable version under
`latest`. It must show the new package only under `dev` or `rc` as appropriate.

## Workflow authentication and boundaries

- `.github/workflows/publish.yaml` handles `develop` pushes and published GitHub
  Releases. `.github/workflows/release-verification.yaml` runs the live smoke
  tests against production on every `main` push and never publishes. Ordinary
  PR CI has no credentials, runs no live tests, and cannot publish.
- Dev packages, including explicit dev Releases, run the live smoke tests against
  the dev environment. RC and stable Releases run them against production.
- Metadata and ancestry checks reject unsupported versions, mismatches,
  incorrect prerelease flags, dev commits outside `develop`, and RC/stable
  commits outside `main`. Automatic dev metadata must identify the exact push.
- Only the tarball that passed lint, typechecking, tests, package installation,
  module loading, and deployed smoke checks is published.
- npm Trusted Publishing supplies a short-lived OIDC credential without a
  long-lived npm token. The workflow filename remains `publish.yaml`.
- Smoke tests authenticate to AWS using a separate GitHub OIDC role, then read
  a dedicated project API key from Secrets Manager. The key is masked and
  passed only in the smoke child process environment, never command arguments,
  source files, artifacts, or GitHub Secrets. Missing configuration or a failed
  secret read prevents publication.

Configure the following repository Variables before enabling publication. The
`LAMBDADB_DEV_` Variables serve dev packages; the `LAMBDADB_PROD_` Variables
serve `main` verification and RC/stable Releases. A missing production Variable fails those
runs; it never falls back to the dev environment.

| Variable | Value |
| :-- | :-- |
| `LAMBDADB_DEV_BASE_URL` | `https://internal-dev-aws-apne2-v3-c05a2b5d492a.lambdadb.ai` |
| `LAMBDADB_DEV_PROJECT_NAME` | Dedicated SDK smoke project in `dev-aws-apne2-v3` |
| `LAMBDADB_DEV_SMOKE_AWS_ROLE_ARN` | Dedicated dev AWS OIDC role ARN |
| `LAMBDADB_DEV_SMOKE_SECRET_ARN` | Exact ARN of the dev project's API key secret |
| `LAMBDADB_PROD_BASE_URL` | `https://aws-ap-northeast-2-v3.lambdadb.ai` |
| `LAMBDADB_PROD_PROJECT_NAME` | Dedicated SDK smoke project in `prod-aws-apne2-v3` |
| `LAMBDADB_PROD_SMOKE_AWS_ROLE_ARN` | Dedicated production AWS OIDC role ARN |
| `LAMBDADB_PROD_SMOKE_SECRET_ARN` | Exact ARN of the production project's API key secret |

Store each project key as a plain SecretString in `ap-northeast-2`. Use a
dedicated project where test Collections may be created and deleted. Set its
`rateLimit` to at least 100 requests per second; the sequential live suite peaks
at about 25 requests per second, and a lower limit returns HTTP 429. Do not grant the
workflow the stack admin key, project creation, deployment, or secret write
permissions. Key rotation updates the AWS secret without changing this workflow.

Provision each role with an OIDC trust condition for audience
`sts.amazonaws.com` and only these subject patterns. The dev role:

```text
repo:lambdadb/lambdadb-typescript-client:ref:refs/heads/develop
repo:lambdadb/lambdadb-typescript-client:ref:refs/tags/v*
```

The production role:

```text
repo:lambdadb/lambdadb-typescript-client:ref:refs/heads/main
repo:lambdadb/lambdadb-typescript-client:ref:refs/tags/v*
```

Each permission policy needs `secretsmanager:GetSecretValue` on the exact smoke
secret ARN of its own environment. Add `kms:Decrypt` on the exact key only if
using a customer-managed KMS key. No `ListSecrets` permission is required by the
CLI reader. Provisioning the roles, projects, keys, and repository Variables is
a separate environment setup step; adding the workflow alone does not establish
working AWS access.

For additional administrative protection, configure a protected GitHub
Environment for npm publishing and update the npm Trusted Publisher settings to
require the same environment. Coordinate both external changes before adding
`environment:` to the workflow; changing only one side can break publishing.

## Failed releases

npm package versions and pushed Git tags are immutable release identities. If
a release is broken, publish the next development, RC, or patch version.
Changing a dist-tag, deprecating a package, or unpublishing a package is an
external, user-visible action and requires explicit approval.

## References

- [Semantic Versioning](https://semver.org/)
- [npm dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages)
- [npm package specification](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
