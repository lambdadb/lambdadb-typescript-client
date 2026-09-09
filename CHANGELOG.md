# Changelog

## Unreleased

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
