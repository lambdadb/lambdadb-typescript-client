# Data Versioning

This SDK implements the public LambdaDB Data Versioning contract in
`reference/api/openapi.json` of lambdadb/docs, pinned at docs commit
[`054c799c7fac3f1220e675dddf599d4c48512c24`](https://github.com/lambdadb/docs/blob/054c799c7fac3f1220e675dddf599d4c48512c24/reference/api/openapi.json)
(SHA-256 `146e722e67b4591081e67bd5c8ba478f6bb6486b0171f5d6adb73ca6eef2f11b`, API 1.3.0), synced from backend revision
`b32acec40f844067ef3845453f94d9e674bc1a86`. This revision adds Branch rollback and nullable
Tag snapshot fields. See the
[source record](https://github.com/lambdadb/docs/blob/054c799c7fac3f1220e675dddf599d4c48512c24/reference/api/openapi-source.json)
for production deployment evidence.

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

const { branch } = await collection.branches.get("candidate");
const { tag } = await collection.tags.get("release-001");
const { alias } = await collection.aliases.get("production");

const { branches } = await collection.branches.list();
const { tags } = await collection.tags.list();
const { aliases } = await collection.aliases.list();

await collection.aliases.delete("production");
await collection.tags.delete("release-001");
await collection.branches.delete("candidate");
```

Branch creation accepts a Branch or Tag source (`RefSource`) in the same
Collection. Omit `source` to use `main`. Without `asOf`, the new Branch pins the
source snapshot, if one exists, and the writes still pending on the source at
creation. It inherits those writes without copying them or waiting for the
source build: ordinary reads of the new Branch
see those writes after its own build commits them, and a direct
`consistentRead` includes the eligible ones immediately. Later writes to the
source are excluded. `tagSource("release-001")` creates the Branch from the
Tag's pinned schema and every write captured when the Tag was created.
`branchSource("dev", asOf)` selects only the latest retained committed snapshot
at or before the cutoff, excluding pending and inherited writes; it is not an
exact-time restore. Alias sources and a Tag source with `asOf` fail SDK input
validation on both `create` and `createSafe`.

`BranchDetails` in create, get, update, and list responses contains `name`,
`createdAt`, `parentBranch`, `headSnapshot`, `parentSnapshot`, `numDocs`,
`dataUpdatedAt`, and `indexConfigs`. The three parent/head metadata fields are
required and nullable:

- `parentBranch: { branchId, name }` records the direct source Branch at creation,
  even when that source is empty or `asOf` selects a snapshot originating on an
  ancestor. It is `null` for `main`, Branches created from Tags, or when no parent
  was recorded. This historical
  identity survives parent deletion and name reuse and does not prevent deletion.
- `headSnapshot` is the current committed head, initially `null` for an empty source.
- `parentSnapshot` stays fixed at the fork snapshot as the head advances. For
  `main` and branches created from an empty source, it remains `null` after commits.

An empty Branch can therefore have a non-null `parentBranch` while both snapshot
fields are null. Parent metadata does not extend snapshot retention. Branches
have no top-level `snapshotId`.

`numDocs` is the document count in the Branch's committed head (`0` for an
empty Branch), and `dataUpdatedAt` is the last data update of that head. It is
required and explicitly `null` for an empty Branch. `indexConfigs` is the
Branch's own index schema and is never null.

Each non-null `SnapshotDetails` contains `snapshotId` and
`snapshotCommittedAt`. `TagDetails` has these fields at the top level alongside
`name`, `createdAt`, `numDocs`, `dataUpdatedAt`, and `indexConfigs` (the schema
pinned by the Tag). Before the first snapshot, `snapshotId`,
`snapshotCommittedAt`, and `dataUpdatedAt` are required and explicitly `null`,
and `numDocs` is `0`. Check for `null` before using those fields. The snapshot
ID can change as captured writes are published.

`AliasDetails` carries `indexConfigs` of the target's version, or `null` for a
dangling Alias. The collection-scoped client converts non-null creation,
snapshot commit, and data update timestamps to `Date`, including nested
snapshots. Types from `models` use numeric Unix milliseconds.

Tag creation accepts a Branch or Tag source (`RefSource`), with omission
selecting `main`. Without `asOf`, a Tag captures the source snapshot if one
exists and any pending writes at creation time. A source with pending writes
can be tagged before its first snapshot. Ordinary Query and Fetch reads of a
Tag include eligible captured writes. Bulk imports and document listings show
those changes after a build publishes them. `tagSource("release-001")` copies
that Tag's fixed state. `asOf` is valid only for a Branch source and selects the
latest retained committed snapshot at or before the cutoff. A source with
neither a snapshot nor pending writes returns `BadRequestError` (HTTP `400`),
as does unavailable `asOf` history.

### Single ref reads

`branches.get(name)`, `tags.get(name)`, and `aliases.get(name)` return one ref
in the same shape as create and list entries. A name that is not a ref of that
kind fails with `ResourceNotFoundError` (HTTP `404`). `aliases.get` returns the
index schema the Alias currently serves, read through to its target; a dangling
Alias still succeeds with `dangling: true` and `indexConfigs: null`.

### Branch index schemas

A Branch owns its `indexConfigs`. A new Branch inherits the source Branch's
current schema, the Tag's pinned schema, or the origin snapshot's schema for an
`asOf` Branch; later schema updates of other Branches, including `main`, do not
change it. A Tag keeps the schema its snapshot was built with.

```typescript
const { branch } = await collection.branches.get("candidate");
await collection.branches.update("candidate", {
  indexConfigs: { ...branch.indexConfigs, author: { type: "keyword" } },
});
```

`branches.update(name, { indexConfigs })` changes that Branch only; updating
`main` also updates the Collection's `indexConfigs`, which mirror `main`. The
body is strict and carries `indexConfigs` only: description, tags, and snapshot
retention stay on `collection.update`. The same additive rule as a Collection
update applies within the Branch: send the Branch's complete existing schema
(the server-managed `id` field may be included or omitted), add fields at any
object depth, and set, replace, or clear field descriptions. An empty or
missing `indexConfigs`, or any other key, fails locally with
`SDKValidationError`. Naming a Tag or an Alias returns `BadRequestError`
(HTTP `400`); a conditional conflict returns `CatalogConflictError` (HTTP
`409`). Promoting a Branch's schema to `main` is a manual step: apply the same
additive change to `main`. The server does not check schemas when an Alias is
retargeted across Branches with different schemas.

`indexConfigs` on `collection.update` is deprecated. It still works and updates
the default `main` Branch only, exactly as `branches.update("main", ...)`.

### Roll back a Branch

Roll back a Branch to a Tag in the same Collection to restore the Tag's data
and index schema. The Branch keeps its identity and receives a new head
snapshot.

```typescript
const { branchId, headSnapshot } = await collection.branches.rollback(
  "candidate",
  { tag: "release-001" },
);
console.log(branchId, headSnapshot.snapshotId, headSnapshot.snapshotCommittedAt);
```

The Tag must have a published snapshot. A Tag awaiting publication returns
`BadRequestError` (HTTP `400`). Concurrent requests replacing the same write
stream can return `CatalogConflictError` (HTTP `409`). Use `rollbackSafe` to
receive these errors as a `Result`. The SDK disables automatic retries for
rollback even when backoff is configured. If a call times out, check the Branch
state before trying again because another rollback may undo intervening writes.

### Paginated listings

The server returns Branches, Tags, and Aliases one page at a time in name
order, 10 entries per page by default.

`branches.list(options?)`, `tags.list(options?)`, and `aliases.list(options?)`
keep their signatures and still return every entry (`{ branches }`, `{ tags }`,
`{ aliases }`, without `nextPageToken`). They follow `nextPageToken` with the
server's default page size, so a listing now makes one request per page. If any
page fails, `list` throws and `listSafe` returns that error; no partial list is
returned.

`listPage(params?, options?)` and `listPageSafe` return exactly one page. They
take `{ size, pageToken }` (`ListRefsInput`) first and request options second,
and return `nextPageToken` only when more entries follow. `listPages(params?,
options?)` is an async iterator over the pages, built on `listPage`:

```typescript
const { branches: everyBranch } = await collection.branches.list();

const page = await collection.branches.listPage({ size: 50 });
if (page.nextPageToken !== undefined) {
  await collection.branches.listPage({ size: 50, pageToken: page.nextPageToken });
}

for await (const each of collection.tags.listPages({ size: 100 })) {
  console.log(each.tags);
}
```

The SDK sends `size` and `pageToken` only when they are set and never sends an
empty `pageToken`, because the server rejects an empty token and any other
query parameter with HTTP `400`. On `listPage` and `listPages`, `size` outside 1
through 100, a non-string token, or an unknown key (including request options
passed as the first argument) fails locally with `SDKValidationError`. A
malformed token returns `BadRequestError`. `listCollections` is unchanged in
shape: it returns one page per call, omits an empty `pageToken`, and maps HTTP
`400` to `BadRequestError`.

Deleting a non-default Branch or Tag referenced by any Alias returns
`CatalogConflictError` (HTTP `409`). Delete or retarget every referencing Alias
before retrying; the SDK does not automatically retry `409` by default. Deleting
`main` returns `BadRequestError` (HTTP `400`). Deleting an Alias leaves its
target intact.

Aliases bind to target identities. If a missing target is encountered,
`dangling` is `true` and document reads fail with `BadRequestError` (HTTP
`400`), while `aliases.get` still returns the Alias with `indexConfigs: null`;
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

Document write API requests automatically retry HTTP `429`, all `5xx` responses
(including `500`, `502`, `503`, and `504`), and connection errors or transport timeouts by
default. This also applies to `*Safe` methods. A failed write may already have
committed, and automatic retries may reapply it before the SDK returns an error
or a successful response; retries do not provide exactly-once execution.

If the caller needs to inspect state before deciding whether to retry, pass
`{ retries: { strategy: "none" } }` on the initial write call. This disables
automatic retries but does not cancel a server-side write or prove that it
failed. Inspect the target Branch state and consider the operation's semantics
before submitting another write. See the [retry configuration and example](../README.md#retries).

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

A page token is an opaque search position. Between pages, a Branch can advance,
an Alias can move, and a Tag can publish writes it captured at creation. For a
stable multi-page export, use the same Tag created with `asOf` and keep filters
and projection unchanged.

Document listing reads only the currently published snapshot for every ref,
including Tags and Aliases that target Tags. Pending writes become visible to
listing only after a build publishes a snapshot; listing applies no pending
overlay.

`consistentRead: true` overlays eligible inherited and own pending writes on the
selected Branch's committed snapshot; ordinary Branch reads use only the
snapshot. It is allowed for an omitted ref (implicit `main`), a Branch
ref, or an Alias ref that currently targets a Branch; the server resolves the
Alias to its Branch when the request is admitted. Tag reads and reads through an
Alias that targets a Tag already include the Tag's eligible fixed inherited
writes on Query and Fetch, but reject `consistentRead: true`: a Tag ref fails
local validation, and an Alias that targets a Tag fails with `BadRequestError`
(`400`). Pending bulk imports are excluded until a background build materializes
them, and an oversized eligible pending overlay can return
`TooManyRequestsError` (`429`). The public Query and Fetch input unions reject
`consistentRead: true` with a Tag ref at compile time, and runtime validation
protects JavaScript callers; Alias target resolution stays on the server.

```typescript
await collection.query({
  query: { queryString: { query: "title:candidate" } },
  ref: aliasRef("production"),
  consistentRead: true,
});
```

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
`defaultBranchName: "main"`. Collection create returns the same full shape as
`collection.get()`, including the normalized `indexConfigs` of `main`. Wire timestamps use Unix epoch milliseconds; the
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
by the API; only a field's optional `description` may change on an update, and
the SDK passes the full schema through without fetching the current schema first. Collection responses include the server-managed top-level `id`
field as `{ type: "keyword" }`; requests may send it back unchanged or omit it,
so `indexConfigs` read from `get()` can be reused as the base of an update.

Collection `indexConfigs`, `numDocs`, and optional `dataUpdatedAt` describe the
default `main` Branch, not all Branches or a selected ref; other Branches carry
their own schema and statistics on `branches.get`. A commit without a
data mutation retains the earlier `dataUpdatedAt`; it is absent before a
committed head exists.

Collection create expects HTTP `201`; Collection delete expects HTTP `200`.

Data Versioning Branches and Tags operate inside an existing Collection. They
are not a direct replacement for the removed cross-collection source creation
options.
