# Releasing the TypeScript SDK

This document defines the required packaging and release process for the
`@functional-systems/lambdadb` npm package.

npm is the production distribution channel. Releases are trunk-based: `main` is
the only long-lived branch. A push to `main` whose committed version is already
tagged publishes a dev build automatically, a push to `main` whose committed RC or
stable version is not tagged yet (a release pull request merge) is verified
against production, and a published GitHub Release publishes that RC or stable
version. The repository also contains `jsr.json`, but the current workflow
does not publish to JSR.

## Branches

- Branch from `main`, open a pull request into `main`, and merge it with
  **Squash and merge**. The organization ruleset `protect-main` requires a pull
  request with one approval (the `dev` team may bypass the approval) and blocks
  deletion and force pushes.
- There are no `develop`, release, or hotfix branches. Maintenance releases are
  cut from `main`; anything merged into `main` ships in the next release.

## Version sources

Every build must use the same canonical SemVer version in all four locations:

- `version` in `package.json`
- top-level `version` in `package-lock.json`
- root package version at `packages[""]` in `package-lock.json`
- `version` in `jsr.json`

The local package entry at `packages[".."].version` in
`examples/package-lock.json` and both the `sdkVersion` and embedded User-Agent
version in `src/lib/config.ts` must match those four version sources.

The committed version is always an RC or stable version: between releases it
keeps the most recently released version, whose `v<version>` tag exists. Only a
release pull request changes it, setting the next RC or stable version, and that
exact merge commit is tagged with a leading `v`. A development version is never
committed; CI derives it from the committed version and the tags. Development
packages have no Git tag or GitHub Release.

| Channel | Committed version | Published version | Git tag | npm dist-tag |
| :-- | :-- | :-- | :-- | :-- |
| Development | Last released `X.Y.Z` or `X.Y.Z-rc.N` (tagged) | `X.Y.(Z+1)-dev.N` after a stable release, `X.Y.Z-dev.N` after an RC (N ≥ 1, assigned by CI) | None | `dev` |
| Release candidate | `X.Y.Z-rc.N` | `X.Y.Z-rc.N` | `vX.Y.Z-rc.N` | `rc` |
| Stable | `X.Y.Z` | `X.Y.Z` | `vX.Y.Z` | `latest` |

All packages come from commits on `main`.

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

Change every version source at once with the version script, which keeps each
file's formatting and fails unless all sources agree afterwards:

```bash
node scripts/version.mjs get                 # print the committed version
node scripts/version.mjs set 0.12.0-rc.1     # release pull request
node scripts/version.mjs set 0.12.0          # stable release pull request
```

It accepts only committed forms: `X.Y.Z-rc.N` and `X.Y.Z`. Development forms are
rejected. The publish workflow and test suite reject sources that disagree. Only
release pull requests change the version.

## Development packages

Every reviewed push to `main` whose committed version already has its
`v<version>` tag on `origin` is a development commit. It publishes a dev build
after lint, typechecking, tests, clean tarball installation, and deployed live
smoke tests against the dev environment pass. Merging into `main` authorizes this
automatic dev publication. The workflow queries the tags on `origin`, so a tag
that exists only in a local checkout does not count.

The workflow checks out the exact push SHA and derives the development version
from the committed version:

- After a stable release `X.Y.Z`, it publishes `X.Y.(Z+1)-dev.N`.
- After an RC `X.Y.Z-rc.M`, it publishes `X.Y.Z-dev.N`, which sorts below the RC.

N is the number of first-parent commits on `main` since the newest stable release
tag (`vA.B.C`) reachable from that commit, or since the root commit when there is
none. N is the same on every rerun of a commit, restarts at 1 after each stable
release, and keeps increasing across the RCs of one version. For example, after
`v0.11.0` the next `main` push publishes `0.11.1-dev.1`; after `v0.12.0-rc.1` it
publishes `0.12.0-dev.N`. The workflow fails unless the development version is
newer than the newest stable tag. A rerun of a stable release commit's `main`
push after its tag exists has no development version (N would be 0): the run
succeeds with a notice and skips every later step, including the live smoke
tests and publication; the GitHub Release publishes that commit.

The workflow updates package and lockfile versions, `jsr.json`, SDK metadata, and
User-Agent only in its disposable checkout and creates no commit, tag, or GitHub
Release. The published `package.json` includes
`lambdadbSourceCommit`.

`main` pushes share one concurrency group.
[GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
may replace a pending run with a newer push, so not every intermediate commit is
published. Immediately before publication, the workflow skips a commit that is
no longer the head of `main`, and skips a version already published from the
same commit (a rerun). A version published from a different commit fails the
run. The `dev` dist-tag never moves backwards: a version lower than the current
`dev` dist-tag by SemVer (for example, after a release with a lower version than
earlier dev builds) is skipped with a workflow notice, not a failure. The `dev`
dist-tag points to the highest successfully published build; failed validation
leaves it in place. The exact tarball and npm pack manifest are
retained as workflow artifacts.

## Release candidates and stable releases

1. Open a release pull request into `main` that sets the version with
   `node scripts/version.mjs set 0.12.0-rc.1` (or `0.12.0`) and updates
   `CHANGELOG.md`, release notes, and user-facing documentation. Run the complete
   validation checklist.
2. Merge it. Its version has no tag yet, so that `main` push runs the publish
   workflow in verification mode: the same checks plus live smoke tests against
   production, with no publication. Until the release is tagged, every `main`
   push is verified the same way and publishes no dev build. Do not merge other
   pull requests until the release is tagged, or tag the release pull request's
   merge commit explicitly.
3. After verification passes, tag that exact merge commit (`v0.12.0-rc.1` or
   `v0.12.0`) and publish a GitHub Release. Mark RCs as prereleases and stable
   releases as not prereleases. The workflow runs the production live smoke
   tests again and publishes with npm dist-tag `rc` or `latest`.
4. Verify the registry:

   ```bash
   npm view @functional-systems/lambdadb@rc version
   npm install @functional-systems/lambdadb@0.12.0-rc.1
   ```

Address RC feedback in new pull requests into `main` and release the next RC
number. Never reuse a published version or move its tag.

## Validation checklist

Before publishing any development, RC, or stable package:

- Confirm the source checkout is the exact reviewed commit on `main`. Tagged
  releases require a clean working tree and a tag on the release pull request's
  merge commit. Automatic dev builds may modify only generated version metadata
  in the disposable checkout.
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

- `.github/workflows/publish.yaml` handles `main` pushes and published GitHub
  Releases. A `main` push whose committed version is tagged on `origin`
  publishes a dev build; a `main` push whose committed version is not tagged
  yet only verifies it, and a committed development form fails the run; a
  Release publishes its RC or stable version. Dev versions are never published
  through GitHub Releases. Ordinary PR CI has no credentials, runs no live
  tests, and cannot publish. No workflow writes to the repository or opens
  pull requests.
- Dev builds run the live smoke tests against the dev environment. Release
  verification and RC/stable Releases run them against production.
- Metadata and ancestry checks reject unsupported versions, mismatches,
  incorrect prerelease flags, and commits outside `main`. Automatic dev metadata
  must identify the exact push.
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
`LAMBDADB_DEV_` Variables serve dev builds; the `LAMBDADB_PROD_` Variables serve
release verification and RC/stable Releases. A missing Variable fails the run; it
never falls back to the other environment.

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
at about 25 requests per second, and a lower limit returns HTTP 429. Do not grant
the workflow the stack admin key, project creation, deployment, or secret write
permissions. Key rotation updates the AWS secret without changing this workflow.

Provision each role with an OIDC trust condition for audience
`sts.amazonaws.com` and only these subject patterns. The dev role:

```text
repo:lambdadb/lambdadb-typescript-client:ref:refs/heads/main
```

The production role (release verification on `main`, Releases on tags):

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
