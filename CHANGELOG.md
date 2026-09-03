# Changelog

## Unreleased

Implemented against LambdaDB docs PR #56 at contract revision
`63e07d6b2e281704aa3367fbeb94f40f519241b8` (OpenAPI `1.1.1`). This source
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
  for unauthenticated presigned uploads and out-of-line result downloads.
- Package-root exports for Data Versioning types, helpers, lifecycle clients,
  and the pinned `DATA_VERSIONING_CONTRACT_REVISION`.

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
