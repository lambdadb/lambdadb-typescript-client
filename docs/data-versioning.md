# Data Versioning

This SDK implements the public LambdaDB Data Versioning contract pinned at
[`63e07d6b2e281704aa3367fbeb94f40f519241b8`](https://github.com/lambdadb/docs/commit/63e07d6b2e281704aa3367fbeb94f40f519241b8).
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

Deleting an Alias target leaves a dangling Alias. Its `dangling` field becomes
`true`, and reads through it fail with `ResourceNotFoundError` until it is
retargeted.

Every lifecycle method also has a `*Safe` form returning `Result`. HTTP `400`,
`401`, `404`, `409`, `429`, and `500` responses map to the corresponding
exported LambdaDB error class.

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

Strongly consistent reads are supported only for a direct Branch ref. The
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
```

`bulkUpsertDocs` uses the same Branch for the upload-info and completion calls.
It sends `Content-Type` from the server's `type` field and every server-returned
signed header to the presigned PUT. API authentication and API-only request
headers are not forwarded to the storage URL.

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

Collection create expects HTTP `201`; Collection delete expects HTTP `200`.

Data Versioning Branches and Tags operate inside an existing Collection. They
are not a direct replacement for the removed cross-collection source creation
options.
