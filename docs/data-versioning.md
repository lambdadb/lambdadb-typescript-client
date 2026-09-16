# Data Versioning

This SDK implements the public LambdaDB Data Versioning contract pinned at
[`c44180406c05b1a9043d8516e7c7f60df91fc9a7`](https://github.com/lambdadb/docs/commit/c44180406c05b1a9043d8516e7c7f60df91fc9a7).
The source revision identifies the implementation contract; it does not by
itself prove that a particular API environment has deployed that contract.

Every Collection has a default writable Branch named `main`. Branches, Tags,
and Aliases are scoped to one Collection.

## Ref helpers

The package root exports helpers that validate names and return discriminated
unions:

```typescript
import {
  aliasRef,
  branchRef,
  branchSource,
  branchTarget,
  tagRef,
  tagSource,
  tagTarget,
} from "@functional-systems/lambdadb";

branchRef("candidate");
tagRef("release-001");
aliasRef("production");
branchSource("main", new Date("2026-09-02T00:00:00.123Z"));
tagSource("release-001");
branchTarget("candidate");
tagTarget("release-001");
```

`asOf` is available only on a Branch source. A `Date` passed to
`branchSource` is serialized as Unix epoch milliseconds. Ref names contain 3
to 52 letters, numbers, underscores, or hyphens.

## Lifecycle

```typescript
const collection = client.collection("knowledge-base");

await collection.branches.create({
  branchName: "candidate",
  source: branchSource("main"),
});

await collection.tags.create({
  tagName: "release-001",
  source: branchSource("candidate"),
});

await collection.aliases.create({
  aliasName: "production",
  target: tagTarget("release-001"),
});

await collection.aliases.retarget("production", {
  target: branchTarget("candidate"),
});

const { branches } = await collection.branches.list();
const { tags } = await collection.tags.list();
const { aliases } = await collection.aliases.list();

await collection.aliases.delete("production");
await collection.tags.delete("release-001");
await collection.branches.delete("candidate");
```

Branch creation accepts only a `BranchSource` in the same Collection and copies
its committed state. Omit `source` to use `main`; `branchSource("dev", asOf)`
selects a retained committed snapshot at or before the cutoff. Tag and Alias
sources fail SDK input validation on both `create` and `createSafe`.

`BranchDetails` in create and list responses contains `name`, `createdAt`,
`parentBranch`, `headSnapshot`, and `parentSnapshot`. All three metadata fields
are required and nullable:

- `parentBranch: { branchId, name }` records the direct source Branch at creation,
  even when that source is empty or `asOf` selects a snapshot originating on an
  ancestor. It is `null` for `main` or when no parent was recorded. This historical
  identity survives parent deletion and name reuse and does not prevent deletion.
- `headSnapshot` is the current committed head, initially `null` for an empty source.
- `parentSnapshot` stays fixed at the fork snapshot as the head advances. For
  `main` and branches created from an empty source, it remains `null` after commits.

An empty Branch can therefore have a non-null `parentBranch` while both snapshot
fields are null. Parent metadata does not extend snapshot retention. Branches
have no top-level `snapshotId`.

Each non-null `SnapshotDetails` contains `snapshotId` and
`snapshotCommittedAt`. `TagDetails` has these fields at the top level alongside
`name` and `createdAt`; its snapshot cannot be null. The collection-scoped
facade converts both creation and snapshot commit timestamps to `Date`, including
nested Branch snapshots. Types from `models` retain numeric Unix milliseconds.

Tag creation continues to accept a Branch or Tag source (`RefSource`), with
omission selecting `main`. `tagSource("release-001")` pins the same snapshot,
not a chain of Tags. Alias sources are rejected, and `asOf` is valid only for a
Branch source. Tags require a committed Snapshot, so verify committed data before
creating one. Data mutations are accepted asynchronously and are not necessarily
committed when their request returns.

Deleting a non-default Branch or Tag referenced by any Alias returns
`CatalogConflictError` (HTTP `409`). Delete or retarget every referencing Alias
before retrying; the SDK does not automatically retry `409` by default. Deleting
`main` returns `BadRequestError` (HTTP `400`). Deleting an Alias leaves its
target intact.

Aliases bind to target identities. If a missing target is encountered,
`dangling` is `true` and reads fail with `BadRequestError` (HTTP `400`);
recreating the same target name does not repair the binding. Normal target
deletion is blocked while Aliases reference it. Selecting a ref that does not
exist fails with `ResourceNotFoundError` (HTTP `404`).

Every lifecycle method is asynchronous and also has a `*Safe` form returning
`Promise<Result<...>>`; there is no synchronous network client. Ref/source
helpers validate synchronously. Documented
HTTP failures map to exported error classes, including
`CatalogConflictError`, `PayloadTooLargeError`, `BadGatewayError`,
`ServiceUnavailableError`, and `GatewayTimeoutError`. Create-name collisions
remain `ResourceAlreadyExistsError`. All HTTP errors retain status, body,
headers, and the raw `Response`; `retryAfter` exposes the optional header.
After a write receives `BadGatewayError` or `GatewayTimeoutError`, treat its
outcome as uncertain and verify state before retrying.

## Ref-scoped reads

Query, Fetch, and List accept a `ref`; omitting it preserves the existing
`main` read behavior.

```typescript
const ref = aliasRef("production");

await collection.query({ query: { text: "hello" }, ref });
await collection.docs.fetch({ ids: ["doc-1"], ref });

for await (const page of collection.docs.listPages({ size: 50, ref })) {
  console.log(page.docs);
}
```

`listPages` and `listAll` preserve the selected ref on every request. Simple
lists use the GET endpoint with paired `refKind` and `refName` query
parameters. Lists with filters, partition filters, or field selection use the
extended POST endpoint and put `ref` in its body.

A page token is an opaque search position, not a Snapshot pin. A Branch can
advance and an Alias can move between page requests. Use the same immutable Tag
and unchanged filters/projection throughout a stable multi-page export.

`consistentRead: true` overlays eligible pending writes on committed data and
is supported only for a direct Branch ref or an omitted ref (implicit `main`).
Pending bulk imports are excluded, and an oversized pending overlay can return `TooManyRequestsError` (`429`). The
public Query and Fetch input unions reject `consistentRead: true` with a Tag or
Alias at compile time, and runtime validation protects JavaScript callers.

## Branch-scoped writes

Upsert, Update, Delete, and Bulk Upsert accept an optional `branch` string.
Omitting it writes to `main`; Tags and Aliases are never write targets.

```typescript
await collection.docs.upsert({
  branch: "candidate",
  docs: [{ id: "doc-1", title: "Candidate" }],
});

await collection.docs.delete({
  branch: "candidate",
  ids: ["doc-1"], // Use exactly one of ids or filter.
});
```

`bulkUpsertDocs` uses the same Branch for the upload-info and completion calls.
It sends `Content-Type` from the server's `type` field and every server-returned
signed header to the presigned PUT. API authentication and API-only request
headers are not forwarded to the storage URL.

The low-level `bulkUpsert({ objectKey, branch })` completion call may omit
`type`. If supplied, it is optional string metadata; the server validates the
uploaded object's Content-Type rather than this field. Setting completion
`type` does not replace the required upload `Content-Type: application/json`.
The automatic `bulkUpsertDocs` helper continues to send the upload-info `type`
in both the PUT header and completion body.

The signed PUT is create-only and can return storage HTTP `412` if reused.
`bulkUpsertDocs` does not retry that PUT or issue the completion request after
an unsuccessful upload. Obtain a new upload URL for a new attempt and resolve
an uncertain prior completion before resubmitting.

Use a separate transfer transport for presigned uploads and out-of-line result
downloads:

```typescript
import { HTTPClient, LambdaDBClient } from "@functional-systems/lambdadb";

const transferClient = new HTTPClient({
  fetcher: (request) => fetch(request),
});

const client = new LambdaDBClient({
  projectApiKey: "...",
  transferClient,
});
```

Per-call `AbortSignal` and `timeoutMs` are applied to transfer requests without
copying API headers.

## Collection metadata and timestamps

Collection create and update accept `description`, up to five metadata `tags`,
and `snapshotRetentionInDays` from 1 through 31. Responses include
`defaultBranchName: "main"`. Wire timestamps use Unix epoch milliseconds; the
collection-scoped facade converts them directly to `Date` without a seconds
multiplier.

`indexConfigs` must contain at least one field. Metadata tag values must contain
a non-whitespace character under Java `String.isBlank` semantics. PATCH
omission or `null` leaves a field unchanged, but at least one field must be
non-null. Supplied tags replace the entire map (`{}` clears it), and `""`
clears the description. Schema updates send the complete schema and preserve
existing nested field definitions.

New top-level fields and nested children at any object depth are supported.
Include all existing fields, retaining their types, analyzers, vector settings,
and embedding configuration. Removing or changing existing fields is rejected
by the API; the SDK passes the full schema through without fetching the current
schema first.

Collection `numDocs` and optional `dataUpdatedAt` describe the default `main`
Branch's committed head, not all Branches or a selected ref. A commit without a
data mutation retains the earlier `dataUpdatedAt`; it is absent before a
committed head exists.

Collection create expects HTTP `201`; Collection delete expects HTTP `200`.

Data Versioning Branches and Tags operate inside an existing Collection. They
are not a direct replacement for the removed cross-collection source creation
options.
