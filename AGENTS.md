# Repository agent instructions

These instructions apply to the entire repository.

<!-- CLONE:ARTIFACT-REVIEW-CONTRACT:START -->
## Artifact review contract

When a response creates, changes, or relies on an artifact that needs human
review, the final response must list every such artifact with a directly
reviewable URI. Use an absolute local path for a local artifact and a direct URL
or deep link for a remote artifact. Include enough context to identify what
should be reviewed, and do not claim that an artifact was reviewed unless it
was actually opened and checked.
<!-- CLONE:ARTIFACT-REVIEW-CONTRACT:END -->

## Packaging and release policy

For any task that changes the SDK implementation, public API, API contract,
package metadata, version, Git tag, GitHub Release, npm dist-tag, or publishing
workflow, read and follow [RELEASING.md](RELEASING.md) in full before making
changes. `RELEASING.md` is the source of truth for packaging and releases.

The following rules are mandatory:

- Pin the exact API contract revision used for implementation. A source branch
  or documentation revision is not evidence that the API is deployed.
- Keep the versions in `package.json`, both version locations in
  `package-lock.json`, and `jsr.json` identical.
- Use canonical SemVer versions: `X.Y.Z-dev.N` for development packages,
  `X.Y.Z-rc.N` for release candidates, and `X.Y.Z` for stable releases.
- Publish development packages with npm dist-tag `dev`, release candidates with
  `rc`, and stable releases with `latest`. Never assign `latest` to a
  prerelease.
- Mark development and RC GitHub Releases as prereleases. Stable releases must
  not be marked as prereleases.
- Never replace an existing npm package version or move a published Git tag.
  Publish the next development, RC, or patch version instead.
- Never create or push a tag, publish or edit a GitHub Release, publish to npm,
  change an npm dist-tag, deprecate a package, or unpublish a package without
  explicit user approval.
- Run the release checks in `RELEASING.md` and the applicable environment smoke
  tests before any development, RC, or stable publication.
