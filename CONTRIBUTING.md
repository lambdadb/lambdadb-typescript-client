# Contributing to This Repository

This SDK is maintained manually. Direct fixes and pull requests are welcome,
including changes to files that retain historical code-generator headers.
Follow [OpenAPI maintenance](docs/OPENAPI_UPDATE.md) when updating API contracts
and pin the exact upstream revision used for the change.

## Reporting issues

Open a GitHub issue with reproduction steps, expected and actual behavior, the
SDK and runtime versions, and relevant errors. Remove API keys, authorization
headers, signed URLs, and private document content from shared evidence.

## Preparing a pull request

Branch from the current `develop` and open the pull request against `develop`;
select the base explicitly because GitHub defaults to `main`. Feature and fix
pull requests are merged with **Squash and merge**. See
[Branches and merges](RELEASING.md#branches-and-merges) for release and hotfix
branches, promotion to `main`, and `main` -> `develop` back-merges.

Keep changes focused and preserve existing public API and wire behavior unless
an intentional contract change requires otherwise. Update relevant examples,
reference documentation, and tests together. The recommended public entry point
is `LambdaDBClient`; standalone functions and deprecated clients must retain
their documented compatibility.

Use the Node.js version in CI (currently Node 24) and run:

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

`npm test` builds ESM and CommonJS packages, compiles package-consumer type tests,
and runs the local test suite. Credentialed live tests are separate; use the
intended environment explicitly and verify cleanup of temporary resources.
Report which checks ran and distinguish mocked tests from live server results.
Do not commit generated `dist`, local credentials, or scratch logs.

## Releases

Maintainers must follow [RELEASING.md](RELEASING.md) for version alignment,
package validation, GitHub Releases, and npm publication. Creating a pull request
does not publish a package.
