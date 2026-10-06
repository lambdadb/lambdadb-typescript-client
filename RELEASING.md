# Releasing the TypeScript SDK

This document defines the required packaging and release process for the
`@functional-systems/lambdadb` npm package.

npm is the production distribution channel. A push to `develop` starts automatic
dev publication. A published GitHub Release starts explicit dev, RC, or stable
publication. The repository also contains `jsr.json`, but the
current workflow does not publish to JSR.

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

For an explicit tagged release, create the release version on a reviewed branch.
Automatic dev publication generates its version in CI instead. For example:

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
tests, clean tarball installation, and deployed docsUrl smoke checks pass. A
merge into `main` is not required. Protect `develop` so only reviewed changes
reach this publication trigger; merging into it authorizes automatic dev
publication under this policy.

The workflow checks out the exact push SHA and generates `X.Y.Z-dev.N`, where
`X.Y.Z` is the committed package version's core and `N` is
`GITHUB_RUN_ID * 1000 + GITHUB_RUN_ATTEMPT`. Maintainers control the core version
through reviewed changes. Each rerun gets a new immutable version. The workflow
updates package and lockfile versions, `jsr.json`, SDK metadata, and User-Agent
only in its disposable checkout. It creates no version commit, Git tag, or
GitHub Release. The published `package.json` includes `lambdadbSourceCommit`.

Automatic dev runs are serialized. Immediately before publication, the workflow
fetches `develop` and skips a commit that is no longer its head. GitHub may
replace a pending run with a newer push; not every intermediate commit is
published. The `dev` dist-tag points to the latest successfully published
build. Failed validation leaves the previously published dev version in place.
The exact tarball and npm pack manifest are retained as workflow artifacts.

An explicit dev GitHub Release remains supported when a manually selected
version is needed: align all committed version sources, complete validation,
merge into `develop`, obtain publication approval, tag that exact commit, and
publish a GitHub prerelease. Explicit RC and stable releases still use `main`.
Never reuse a published version or move its tag.

## Release candidates

Release candidates use a version such as `0.5.0-rc.1`. Complete validation and
merge the reviewed release commit into `main` before tagging that exact commit.
Mark the GitHub Release as a prerelease; the workflow publishes it with npm
dist-tag `rc`.

Verify the candidate explicitly:

```bash
npm view @functional-systems/lambdadb@rc version
npm install @functional-systems/lambdadb@0.5.0-rc.1
```

Address feedback in a new commit and increment the RC number.

## Stable releases

Publish the matching stable version only after prerelease feedback is resolved.

1. Set all version sources to the stable version, such as `0.5.0`.
2. Update release notes and user-facing documentation.
3. Run the complete validation checklist.
4. Merge the reviewed release commit into `main`.
5. Tag that exact commit as `v0.5.0`.
6. Create a GitHub Release that is not marked as a prerelease.
7. Wait for the workflow to publish with npm dist-tag `latest`.
8. Verify a clean installation and the registry dist-tags.

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
- Run `npm run test:live:docs-url` against the intended deployed endpoint before
  every publication. This creates a temporary Collection with two 3 MiB
  documents and requires real `docsUrl` array downloads for Query, Fetch, GET/POST
  List, and their Safe methods, then verifies Collection deletion. An inline-only
  response or missing environment variables is a failure, not a skipped check.
  Record the environment, SDK commit, observed behavior, and cleanup result;
  source revision alone does not establish the deployed server revision.
- For explicit releases, review release notes before publishing the GitHub Release.

The docsUrl smoke reads `LAMBDADB_BASE_URL`, `LAMBDADB_PROJECT_NAME`, and
`LAMBDADB_PROJECT_API_KEY` from the environment or `.env.local`. Use a project
where temporary test Collections may be created and deleted. For a worktree
without its own environment file, load the original checkout's file explicitly:

```bash
npm run build
node --env-file=/absolute/path/to/original-checkout/.env.local \
  --test test/integration/docs-url-live.test.mjs
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
  Releases. Ordinary PR CI has no credentials and cannot publish.
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

Configure the following repository Variables before enabling publication:

| Variable | Value |
| :-- | :-- |
| `LAMBDADB_BASE_URL` | `https://internal-dev-aws-apne2-v3-c05a2b5d492a.lambdadb.ai` |
| `LAMBDADB_PROJECT_NAME` | Dedicated SDK smoke project in `dev-aws-apne2-v3` |
| `LAMBDADB_SMOKE_AWS_ROLE_ARN` | Dedicated AWS OIDC role ARN |
| `LAMBDADB_SMOKE_SECRET_ARN` | Exact ARN of the project's API key secret |

Store the project key as a plain SecretString in `ap-northeast-2`. Use a
project where test Collections may be created and deleted. Do not grant the
workflow the stack admin key, project creation, deployment, or secret write
permissions. Key rotation updates the AWS secret without changing this workflow.

Provision the role with an OIDC trust condition for audience `sts.amazonaws.com`
and only these subject patterns:

```text
repo:lambdadb/lambdadb-typescript-client:ref:refs/heads/develop
repo:lambdadb/lambdadb-typescript-client:ref:refs/tags/v*
```

Its permission policy needs `secretsmanager:GetSecretValue` on the exact smoke
secret ARN. Add `kms:Decrypt` on the exact key only if using a customer-managed
KMS key. No `ListSecrets` permission is required by the CLI reader. Provisioning
the role, project, key, and repository Variables is a separate environment
setup step; adding the workflow alone does not establish working AWS access.

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
