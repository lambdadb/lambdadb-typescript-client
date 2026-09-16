# Changelog

## 0.5.0

Aligned with [docs c441804](https://github.com/lambdadb/docs/blob/c44180406c05b1a9043d8516e7c7f60df91fc9a7/reference/api/openapi.json)
and [server PR #405](https://github.com/lambdadb/lambdadb/pull/405), merged as
`d1a76659884a9ed09283a0b2e2989897dc799247`. The pinned contract is
`c44180406c05b1a9043d8516e7c7f60df91fc9a7`, reviewing `c8495bf..c441804`.
These source revisions do not establish deployment in a target environment.

- **Breaking:** Branch creation accepts only `BranchSource`, in both TypeScript
  inputs and runtime validation (`create` / `createSafe`). Replace Tag sources
  with the intended source Branch. Omitting source still selects `main`, and
  Branch `asOf` support is unchanged. Tag creation continues to accept Branch
  or Tag sources; Alias sources and Tag `asOf` remain invalid.
- Branch create/list responses now require nullable `parentBranch`, with
  exported `ParentBranchDetails` containing `branchId` and `name`. Update mocks
  to include this field. It records the direct source even for empty Branches
  or ancestor snapshots selected by `asOf`; `main` and records without a parent
  return `null`. Parent deletion or name reuse does not alter this metadata.
- Existing nullable snapshot fields, Date conversion, synchronous ref/source
  helpers, and Promise-based ordinary / Safe lifecycle paths are preserved.
  There is no synchronous network API.
- Promotes the RC1–RC3 Data Versioning work to the stable `0.5.0` package:
  ref lifecycle, ref-scoped reads, Branch writes, retention, signed bulk uploads,
  collection metadata, and typed HTTP errors. See the RC entries below for the
  cumulative changes from stable `0.4.3`.
- Updated the Qdrant live smoke test to exercise supported filtered scrolling
  after data commits; numeric point offsets remain unsupported.

## 0.5.0-rc.3 - 2026-09-15

Aligned with [the pinned OpenAPI contract](https://github.com/lambdadb/docs/blob/c8495bf47cd8918cfd546b4742823fd4cf3d0814/reference/api/openapi.json)
at `c8495bf47cd8918cfd546b4742823fd4cf3d0814`, reviewing `b171ff0..c8495bf`.
This records the source contract, not deployment evidence.

- Replaced `RefDetails` with separate `BranchDetails`, `TagDetails`, and
  `SnapshotDetails`. Branches expose required nullable `headSnapshot` and
  `parentSnapshot`; migrate `branch.snapshotId` to
  `branch.headSnapshot?.snapshotId`. The parent is fixed fork metadata. Tags
  retain a non-null `snapshotId` and add `snapshotCommittedAt`. All facade
  timestamps are `Date`, including nested snapshot commit times; wire model
  timestamps remain numeric milliseconds. Update response mocks accordingly.
- Bulk completion `type` is now an optional string and stays omitted when not
  supplied. Automatic uploads retain the required JSON Content-Type header,
  signed headers, and completion type from the upload-info response.
- Corrected schema-update guidance to allow nested additions at any depth while
  preserving existing fields and settings. Existing serialization is unchanged.
- Corrected Alias deletion guidance and live tests: referenced Branch/Tag
  deletion returns `CatalogConflictError` (409); delete or retarget all Aliases
  first. Existing error mapping and no automatic 409 retry remain unchanged.
- Verified existing Query/Fetch validation: `consistentRead: true` accepts
  direct Branch refs and implicit main, and rejects Tag/Alias refs.
- Updated development-only dependency resolutions through PR #21; runtime
  dependency requirements are unchanged.

## 0.5.0-rc.2 - 2026-09-09

Aligned with LambdaDB docs PR #56 at contract revision
`b171ff0a408bbeb024535941b83b861d205a829f`
(`reference/api/openapi.json`), reviewing `a52ce19..b171ff0`. This pins the
source contract and does not establish deployment or general availability.

### Added

- Added `CatalogConflictError`, `PayloadTooLargeError`, `BadGatewayError`,
  `ServiceUnavailableError`, and `GatewayTimeoutError` for the newly documented
  `409`, `413`, `502`, `503`, and `504` responses. Every `LambdaDBError` exposes
  the optional `retryAfter` response header; the existing retry engine honors
  it when retrying `429` responses.

### Changed

- Public operation error unions and standalone function return types now
  explicitly include the mapped Gateway error classes. Collection update/delete
  declare `CatalogConflictError`; create retains `ResourceAlreadyExistsError`.
- Collection create/update now reject empty `indexConfigs`. Metadata tag values
  reject Unicode whitespace-only strings using the server's Java
  `String.isBlank` character set.
- Collection PATCH inputs may include `null` as an unchanged field only when at
  least one other supported field is non-null. Supplied tags replace the map,
  `{}` clears it, and `""` clears the description.
- `DeleteDocsInput` now requires exactly one of `ids` or `filter`;
  `partitionFilter` can only narrow one of those selectors. Unknown JSON body
  fields are rejected before sending rather than silently discarded.
- Clarified that Collection statistics describe the default `main` Branch,
  consistent reads overlay eligible non-bulk pending writes, page tokens are
  positions rather than Snapshot pins, and presigned create-only PUT failures
  require a fresh upload URL instead of an automatic retry.
- Documented the pinned server restriction that rejects additions below an
  existing object schema field; the SDK leaves this state-dependent check to
  the API while requiring a nonempty complete schema map.

### Migration from 0.5.0-rc.1

- Empty `indexConfigs` now fails validation on Collection create/update and
  full Collection responses. Supply at least one indexed field; update mocks
  returning an empty schema. On PATCH, omit `indexConfigs` to retain the schema.
- Metadata tag values must not be blank under Java `String.isBlank` semantics.
  Replace whitespace-only values with meaningful text or remove the tag.
- PATCH fields now accept `null` as a no-op, but an empty or all-null PATCH is
  invalid. Send at least one non-null field. Use `tags: {}` to clear tags and
  `description: ""` to clear the description; `null` does not clear either.
- Document delete types and runtime validation now require exactly one of
  `ids` or `filter`. Split requests that supply both, and provide one selector
  when using `partitionFilter`. An empty filter is an intentional broad delete.
- Unknown top-level JSON request fields now fail validation instead of being
  silently stripped. Remove unsupported fields from request envelopes; custom
  document fields inside `docs` remain supported.
- A bulk-upsert completion request that omits `type` now explicitly sends
  `application/json`. For JSON Lines uploads, preserve the upload-info `type`.
- Collection update/delete HTTP `409` now maps to `CatalogConflictError`.
  Gateway `413`, `502`, `503`, and `504` map to the new concrete classes rather
  than a generic fallback. Update exact-class or `error.name` checks;
  `instanceof LambdaDBError` remains supported. Operation error unions now
  explicitly include these alternatives; create `409` remains
  `ResourceAlreadyExistsError`.

No public method, model field, or package export path is removed in RC2.
Timestamp types and successful HTTP statuses are unchanged from RC1.
For migration from stable `0.4.3`, also apply the breaking changes below;
RC2's nonempty-schema requirement supersedes RC1's allowance for `{}`.
Branches and Tags remain Collection-scoped and do not replace cross-Collection
source cloning.

## 0.5.0-rc.1 - 2026-09-04

Implemented against LambdaDB docs PR #56 at contract revision
`a52ce19f5a1ce5ad3a30a55a5560e4591f0be9fa` (OpenAPI `1.1.1`). This source
revision is implementation evidence, not deployment evidence.

### Added

- Collection-scoped Branch, Tag, and Alias create/list/delete lifecycle APIs,
  plus Alias retargeting and `*Safe` variants.
- Discriminated `ReadRef`, `RefSource`, and `AliasTarget` unions and validated
  `branchRef`, `tagRef`, `aliasRef`, `branchSource`, `tagSource`,
  `branchTarget`, and `tagTarget` helpers.
- Ref-scoped Query, Fetch, GET List, and extended List behavior. Document page
  iterators and list-all helpers preserve the selected ref on every page.
- Branch-scoped Upsert, Update, Delete, and Bulk Upsert writes.
- Collection description, metadata tags, default Branch, and snapshot
  retention fields.
- Server-signed bulk-upload header forwarding and a separate `transferClient`
  for unauthenticated presigned uploads and out-of-line result downloads. Safe
  bulk uploads return payload serialization failures through `Result`.
- Package-root exports for Data Versioning types, helpers, lifecycle clients,
  and the pinned `DATA_VERSIONING_CONTRACT_REVISION`.
- Concrete read-ref error mapping: a dangling Alias target returns
  `BadRequestError` (HTTP `400`), while a ref that does not exist returns
  `ResourceNotFoundError` (HTTP `404`).

### Breaking changes from 0.4.3

- `CreateCollectionInput.indexConfigs` is now required, matching the current
  contract. Pass an explicit index configuration record, including `{}` when
  an empty configuration is valid for the target API.
- Removed `sourceProjectName`, `sourceCollectionName`, `sourceDatetime`, and
  `sourceProjectApiKey` from `CreateCollectionInput`. There are no direct
  replacements in the current Collection create contract. Data Versioning
  Branches and Tags operate within one existing Collection and are not a direct
  replacement for cross-collection source creation.
- Removed `sourceProjectName`, `sourceCollectionName`,
  `sourceCollectionVersionId`, and `collectionStatus` from
  `CollectionResponse`. Read `description`, `tags`, `defaultBranchName`, and
  `snapshotRetentionInDays` from the current response instead where relevant.
- `CollectionResponse.createdAt`, `updatedAt`, and `dataUpdatedAt` wire values
  changed from Unix seconds to Unix milliseconds. The collection-scoped facade
  continues to return `Date`, but now constructs it directly from the
  millisecond value. `dataUpdatedAt` is optional when no data update exists;
  `CollectionResponseWithDates.createdAt` and `updatedAt` are now required.
- `LambdaDBClient.createCollection()` now returns the current create response
  shape (`collectionName`, `description`, `tags`, `defaultBranchName`,
  `snapshotRetentionInDays`, and `createdAt`) rather than a full
  `CollectionResponse`; `createdAt` is a `Date` in the facade result.
- `CollectionHandle.update()` and `updateSafe()` now return collection
  timestamps as `Date`, consistent with Get and List. The Update input no
  longer requires `indexConfigs`; it requires at least one of `indexConfigs`,
  `description`, `tags`, or `snapshotRetentionInDays`.
- Collection create accepts only HTTP `201` as success instead of `202`.
  Collection delete accepts only HTTP `200` instead of `202`. Update mock
  servers and custom transports accordingly.
- `GetBulkUpsertDocsResponse.headers` is now required and must be forwarded to
  the presigned PUT. Its `type`, `httpMethod`, and `sizeLimitBytes` fields must
  also be present in the server response instead of being filled by SDK-side
  defaults. `BulkUpsertInput` adds the server-returned `type` and the optional
  write `branch`; low-level callers should preserve both values from the
  upload-info flow.

No package export path was removed or renamed. Existing package-root and
document operation methods remain available; Data Versioning extends their
inputs with optional ref or Branch selectors.
