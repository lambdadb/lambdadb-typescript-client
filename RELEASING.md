# Releasing the TypeScript SDK

This document defines the required packaging and release process for the
`@functional-systems/lambdadb` npm package.

npm is the production distribution channel. A published GitHub Release starts
the npm publishing workflow. The repository also contains `jsr.json`, but the
current workflow does not publish to JSR.

## Version sources

Every build must use the same canonical SemVer version in all four locations:

- `version` in `package.json`
- top-level `version` in `package-lock.json`
- root package version at `packages[""]` in `package-lock.json`
- `version` in `jsr.json`

Release tags add a leading `v` to the same package version.

| Channel | Package version | Git tag | npm dist-tag |
| :-- | :-- | :-- | :-- |
| Development | `X.Y.Z-dev.N` | `vX.Y.Z-dev.N` | `dev` |
| Release candidate | `X.Y.Z-rc.N` | `vX.Y.Z-rc.N` | `rc` |
| Stable | `X.Y.Z` | `vX.Y.Z` | `latest` |

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

Create the release version on a reviewed branch. For example:

```bash
npm version 0.5.0-dev.1 --no-git-tag-version
```

Then update `version` in `jsr.json` to the same value. Confirm all sources:

```bash
node -e '
const p = require("./package.json");
const l = require("./package-lock.json");
const j = require("./jsr.json");
console.log(p.version, l.version, l.packages[""].version, j.version);
'
```

Commit the version update before creating the tag. The publish workflow
validates committed versions and never rewrites them.

## Development packages

Development packages provide an explicit opt-in preview through npm.

1. Pin the API contract revision used for the SDK implementation.
2. Set all version sources to the next unused version, such as
   `0.5.0-dev.1`.
3. Complete the validation checklist and merge the reviewed commit into
   `main`.
4. Tag the exact `main` commit as `v0.5.0-dev.1`.
5. Create a GitHub Release for the tag and mark it as a prerelease.
6. Wait for the **Publish to npm** workflow to publish with dist-tag `dev`.
7. Verify both the exact package and the default stable selection.

If a development package needs a fix, increment `N`. Never reuse a published
version or move its tag.

## Release candidates

Release candidates follow the same sequence using a version such as
`0.5.0-rc.1`. Mark the GitHub Release as a prerelease; the workflow publishes
it with npm dist-tag `rc`.

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

- Confirm the working tree is clean and the tag target is the reviewed `main`
  commit.
- Pin and record the API contract revision used for implementation.
- Confirm the target API is deployed in the intended test environment.
- Confirm the Git tag and all four version locations agree.
- Confirm the version uses the supported canonical SemVer form.
- Run `npm ci`.
- Run `npm run lint`.
- Run `npm test`.
- Build and inspect the package with `npm pack --dry-run`.
- Install the generated tarball in a clean directory.
- Verify both ESM `import` and CommonJS `require` from that installation.
- Complete applicable live and third-party integration smoke tests.
- Review generated release notes before publishing the GitHub Release.

After publication, verify the registry without relying only on the workflow
status:

```bash
npm view @functional-systems/lambdadb dist-tags --json
npm view @functional-systems/lambdadb@0.5.0-rc.1 version
```

For a prerelease, the first command must show the existing stable version under
`latest`. It must show the new package only under `dev` or `rc` as appropriate.

## Workflow boundaries

- `.github/workflows/publish.yaml` runs only for a published GitHub Release.
- The workflow explicitly checks out the release tag and rejects unsupported
  version syntax, version mismatches, incorrect GitHub prerelease flags, and
  release commits outside `main`.
- Only the tarball that passed lint, tests, package installation, and module
  loading checks is published.
- npm Trusted Publishing supplies a short-lived OIDC credential. The workflow
  does not use a long-lived npm token.

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
