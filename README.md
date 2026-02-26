# lambdadb

Developer-friendly & type-safe Typescript SDK specifically catered to leverage *LambdaDB* API.

<div align="left">
    <a href="https://opensource.org/licenses/Apache-2.0">
        <img src="https://img.shields.io/badge/License-Apache--2.0-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>



<!-- Start Summary [summary] -->
## Summary

LambdaDB API: LambdaDB Open API Spec
<!-- End Summary [summary] -->

<!-- Start Table of Contents [toc] -->
## Table of Contents
<!-- $toc-max-depth=2 -->
* [lambdadb](#lambdadb)
  * [SDK Installation](#sdk-installation)
  * [Requirements](#requirements)
  * [SDK Example Usage](#sdk-example-usage)
  * [Authentication](#authentication)
  * [Available Resources and Operations](#available-resources-and-operations)
  * [Standalone functions](#standalone-functions)
  * [Retries](#retries)
  * [Error Handling](#error-handling)
  * [Server Selection](#server-selection)
  * [Custom HTTP Client](#custom-http-client)
  * [Debugging](#debugging)
* [Development](#development)
  * [Maturity](#maturity)
  * [Contributions](#contributions)

<!-- End Table of Contents [toc] -->

<!-- Start SDK Installation [installation] -->
## SDK Installation

The SDK can be installed with either [npm](https://www.npmjs.com/), [pnpm](https://pnpm.io/), [bun](https://bun.sh/) or [yarn](https://classic.yarnpkg.com/en/) package managers.

### NPM

```bash
npm add @functional-systems/lambdadb
```

### PNPM

```bash
pnpm add @functional-systems/lambdadb
```

### Bun

```bash
bun add @functional-systems/lambdadb
```

### Yarn

```bash
yarn add @functional-systems/lambdadb
```

> [!NOTE]
> This package is published with CommonJS and ES Modules (ESM) support.
<!-- End SDK Installation [installation] -->

<!-- Start Requirements [requirements] -->
## Requirements

For supported JavaScript runtimes, please consult [RUNTIMES.md](RUNTIMES.md).
<!-- End Requirements [requirements] -->

<!-- Start SDK Example Usage [usage] -->
## SDK Example Usage

We recommend the **collection-scoped client** (`LambdaDBClient`): you get a handle for a collection once and then call methods without passing `collectionName` on every request.

### Recommended: LambdaDBClient (collection-scoped)

The client connects to `{baseUrl}/projects/{projectName}`. Defaults: **baseUrl** `https://api.lambdadb.ai`, **projectName** `playground`. Override with `baseUrl` and `projectName` when creating the client.

```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
  // Optional: baseUrl (default "https://api.lambdadb.ai"), projectName (default "playground")
});

async function run() {
  // List all collections in the project (optional: pass { size, pageToken } for pagination)
  const list = await client.listCollections();
  console.log(list); // list.collections[].createdAt etc. are Date

  // Work with a specific collection — no collectionName in every call
  const collection = client.collection("my-collection");
  await collection.get();
  await collection.docs.list({ size: 20 });
  await collection.docs.upsert({ docs: [{ id: "1", text: "hello" }] });
  // For large document sets (up to 200MB), use bulkUpsertDocs for a single-call flow
  // await collection.docs.bulkUpsertDocs({ docs: largeDocArray });
}

run();
```

### TypeScript types

Import request and response types from the package for type-safe usage. Use the **input** types for method arguments and the **response** types for return values.

```typescript
import {
  LambdaDBClient,
  type CreateCollectionInput,
  type QueryCollectionInput,
  type QueryCollectionResponse,
  type ListDocsInput,
  type ListDocsResponse,
} from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ projectApiKey: "..." });
const collection = client.collection("my-collection");

// Typed list params
const params: ListDocsInput = { size: 20, pageToken: undefined };
const listResult: ListDocsResponse = await collection.docs.list(params);

// Typed query body and response (or use createQueryInput helper)
const queryBody: QueryCollectionInput = {
  query: { text: "hello" },
  size: 10,
};
const queryResult: QueryCollectionResponse = await collection.query(queryBody);
```

Common types: `CreateCollectionInput`, `UpdateCollectionInput`, `QueryCollectionInput`, `ListDocsInput`, `ListCollectionsInput`, `UpsertDocsInput`, `DeleteDocsInput`, `FetchDocsInput`, `BulkUpsertInput`; response types such as `QueryCollectionResponse`, `ListDocsResponse`, `ListCollectionsResponseWithDates`, `GetCollectionResponseWithDates`, `FetchDocsResponse`, `MessageResponse`; and model types like `CollectionResponseWithDates`, `IndexConfigsUnion`, `PartitionConfig`, `FieldsSelectorUnion`. Collection list/get responses expose timestamp fields (`createdAt`, `updatedAt`, `dataUpdatedAt`) as `Date`. All are exported from the main package.

### Pagination

**Documents:** Use `listPages()` to iterate over all pages without loading everything into memory, or `listAll()` to fetch all docs into a single list. Each page is one API response; the API limits response size by **payload**, not by document count, so the number of docs per page may be less than the requested `size` and can vary from page to page.

```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ projectApiKey: "..." });
const collection = client.collection("my-collection");

// Page-by-page (memory efficient)
for await (const page of collection.docs.listPages({ size: 50 })) {
  console.log(page.docs.length, page.nextPageToken ?? "last page");
}

// Or load all docs (for small/medium collections)
const { docs, total } = await collection.docs.listAll({ size: 100 });
console.log(docs.length, total);
```

**Collections:** Use `listCollections(params?)` with optional `size` and `pageToken`, or `listCollectionsPages(params?)` / `listAllCollections(params?)` to iterate or fetch all collections across pages.

```typescript
// One page
const page = await client.listCollections({ size: 20 });

// Page-by-page
for await (const page of client.listCollectionsPages({ size: 20 })) {
  console.log(page.collections.length, page.nextPageToken ?? "last");
}

// All collections
const { collections } = await client.listAllCollections({ size: 50 });
```

### Query helper

Use `createQueryInput()` to build query parameters for `collection.query()` or `collection.querySafe()`:

```typescript
import { LambdaDBClient, createQueryInput } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ projectApiKey: "..." });
const collection = client.collection("my-collection");

const input = createQueryInput({ text: "hello" }, { size: 10 });
const result = await collection.query(input);
```

<!-- End SDK Example Usage [usage] -->

<!-- Start Authentication [security] -->
## Authentication

### Per-Client Security Schemes

This SDK supports the following security scheme globally:

| Name            | Type   | Scheme  | Environment Variable       |
| --------------- | ------ | ------- | -------------------------- |
| `projectApiKey` | apiKey | API key | `LAMBDADB_PROJECT_API_KEY` |

To authenticate with the API the `projectApiKey` parameter must be set when initializing the SDK client instance. For example:
```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await client.listCollections();
  console.log(result);
}

run();
```
<!-- End Authentication [security] -->

<!-- Start Available Resources and Operations [operations] -->
## Available Resources and Operations

<details open>
<summary>Available methods</summary>

### [Collections](docs/sdks/collections/README.md)

* [list](docs/sdks/collections/README.md#list) - List all collections in an existing project (supports pagination: `size`, `pageToken`). On **LambdaDBClient** use `listCollections(params?)`, `listCollectionsPages(params?)`, or `listAllCollections(params?)` for iteration; collection responses include `createdAt`/`updatedAt`/`dataUpdatedAt` as `Date`.
* [create](docs/sdks/collections/README.md#create) - Create a collection.
* [delete](docs/sdks/collections/README.md#delete) - Delete an existing collection.
* [get](docs/sdks/collections/README.md#get) - Get metadata of an existing collection.
* [update](docs/sdks/collections/README.md#update) - Configure a collection.
* [query](docs/sdks/collections/README.md#query) - Search a collection with a query and return the most similar documents.

#### [Collections.Docs](docs/sdks/docs/README.md)

* [listDocs](docs/sdks/docs/README.md#listdocs) - List documents in a collection.
* [upsert](docs/sdks/docs/README.md#upsert) - Upsert documents into a collection. Note that the maximum supported payload size is 6MB.
* [bulkUpsertDocs](docs/sdks/docs/README.md#bulkupsertdocs) - Bulk upsert documents in one call (up to 200MB); use this for best DX when you have a document list.
* [getBulkUpsert](docs/sdks/docs/README.md#getbulkupsert) - Request required info to upload documents.
* [bulkUpsert](docs/sdks/docs/README.md#bulkupsert) - Bulk upsert documents into a collection. Note that the maximum supported object size is 200MB.
* [update](docs/sdks/docs/README.md#update) - Update documents in a collection. Note that the maximum supported payload size is 6MB.
* [delete](docs/sdks/docs/README.md#delete) - Delete documents by document IDs or query filter from a collection.
* [fetch](docs/sdks/docs/README.md#fetch) - Lookup and return documents by document IDs from a collection.

</details>
<!-- End Available Resources and Operations [operations] -->

### Legacy API (`LambdaDB`)

The classic client `LambdaDB` is still supported for compatibility. New code should prefer `LambdaDBClient` and `client.collection(name)`.

```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({ projectApiKey: "<YOUR_PROJECT_API_KEY>" });
const result = await lambdaDB.collections.list();
await lambdaDB.collections.docs.listDocs({ collectionName: "my-collection", size: 20 });
```

See [docs/sdks/collections/README.md](docs/sdks/collections/README.md) and [docs/sdks/docs/README.md](docs/sdks/docs/README.md) for the full legacy API reference.

<!-- Start Standalone functions [standalone-funcs] -->
## Standalone functions

All the methods listed above are available as standalone functions. These
functions are ideal for use in applications running in the browser, serverless
runtimes or other environments where application bundle size is a primary
concern. When using a bundler to build your application, all unused
functionality will be either excluded from the final bundle or tree-shaken away.

To read more about standalone functions, check [FUNCTIONS.md](./FUNCTIONS.md).

<details>

<summary>Available standalone functions</summary>

- [`collectionsCreate`](docs/sdks/collections/README.md#create) - Create a collection.
- [`collectionsDelete`](docs/sdks/collections/README.md#delete) - Delete an existing collection.
- [`collectionsDocsBulkUpsert`](docs/sdks/docs/README.md#bulkupsert) - Bulk upsert documents into a collection. Note that the maximum supported object size is 200MB.
- [`collectionsDocsDelete`](docs/sdks/docs/README.md#delete) - Delete documents by document IDs or query filter from a collection.
- [`collectionsDocsFetch`](docs/sdks/docs/README.md#fetch) - Lookup and return documents by document IDs from a collection.
- [`collectionsDocsGetBulkUpsert`](docs/sdks/docs/README.md#getbulkupsert) - Request required info to upload documents.
- [`collectionsDocsListDocs`](docs/sdks/docs/README.md#listdocs) - List documents in a collection.
- [`collectionsDocsUpdate`](docs/sdks/docs/README.md#update) - Update documents in a collection. Note that the maximum supported payload size is 6MB.
- [`collectionsDocsUpsert`](docs/sdks/docs/README.md#upsert) - Upsert documents into a collection. Note that the maximum supported payload size is 6MB.
- [`collectionsGet`](docs/sdks/collections/README.md#get) - Get metadata of an existing collection.
- [`collectionsList`](docs/sdks/collections/README.md#list) - List all collections in an existing project.
- [`collectionsQuery`](docs/sdks/collections/README.md#query) - Search a collection with a query and return the most similar documents.
- [`collectionsUpdate`](docs/sdks/collections/README.md#update) - Configure a collection.

</details>
<!-- End Standalone functions [standalone-funcs] -->

<!-- Start Retries [retries] -->
## Retries

Some of the endpoints in this SDK support retries.  If you use the SDK without any configuration, it will fall back to the default retry strategy provided by the API.  However, the default retry strategy can be overridden on a per-operation basis, or across the entire SDK.

To change the default retry strategy for a single API call, simply provide a retryConfig object to the call:
```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await client.listCollections(undefined, {
    retries: {
      strategy: "backoff",
      backoff: {
        initialInterval: 1,
        maxInterval: 50,
        exponent: 1.1,
        maxElapsedTime: 100,
      },
      retryConnectionErrors: false,
    },
  });
  console.log(result);
}

run();
```

If you'd like to override the default retry strategy for all operations that support retries, you can provide a retryConfig at SDK initialization:
```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  retryConfig: {
    strategy: "backoff",
    backoff: {
      initialInterval: 1,
      maxInterval: 50,
      exponent: 1.1,
      maxElapsedTime: 100,
    },
    retryConnectionErrors: false,
  },
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await client.listCollections();
  console.log(result);
}

run();

```

**Timeout and request-level options:** You can set a request timeout (ms) and retry behavior when creating the client or per call. If not set, there is no request timeout. The `RetryConfig` type is exported from the package for typing your options.

```typescript
import { LambdaDBClient, type RetryConfig } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: "...",
  timeoutMs: 30_000,       // 30s timeout for all requests
  retryConfig: { strategy: "backoff", retryConnectionErrors: true },
});

// Override per request
await client.listCollections(undefined, { timeoutMs: 10_000, retries: { strategy: "none" } });
```

<!-- End Retries [retries] -->

<!-- Start Error Handling [errors] -->
## Error Handling

[`LambdaDBError`](./src/models/errors/lambdadberror.ts) is the base class for all HTTP error responses. It has the following properties:

| Property            | Type       | Description                                                                             |
| ------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `error.message`     | `string`   | Error message                                                                           |
| `error.statusCode`  | `number`   | HTTP response status code eg `404`                                                      |
| `error.headers`     | `Headers`  | HTTP response headers                                                                   |
| `error.body`        | `string`   | HTTP body. Can be empty string if no body is returned.                                  |
| `error.rawResponse` | `Response` | Raw HTTP response                                                                       |
| `error.data$`       |            | Optional. Some errors may contain structured data. [See Error Classes](#error-classes). |

### Default methods (throw on error)

Regular methods throw on failure. Catch errors and use `instanceof` to narrow types. Error classes are exported from the main package:

```typescript
import {
  LambdaDBClient,
  LambdaDBError,
  UnauthenticatedError,
  ResourceNotFoundError,
} from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  try {
    const result = await client.listCollections();
    console.log(result);
  } catch (error) {
    if (error instanceof LambdaDBError) {
      console.log(error.message, error.statusCode, error.body);
      if (error instanceof UnauthenticatedError) {
        console.log(error.data$.message);
      }
      if (error instanceof ResourceNotFoundError) {
        console.log("Not found:", error.data$);
      }
    }
  }
}

run();
```

### Safe methods (return Result)

Use `*Safe` methods to get a `Result<T, E>` instead of throwing. You can handle errors without try/catch and narrow with type guards:

```typescript
import {
  LambdaDBClient,
  Result,
  ResourceNotFoundError,
} from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ projectApiKey: "..." });

const result = await client.listCollectionsSafe();
if (result.ok) {
  console.log(result.value.collections);
} else {
  const err = result.error;
  if (err instanceof ResourceNotFoundError) {
    console.log("Not found:", err.data$);
  } else {
    console.error(err);
  }
}
```

Available Safe methods: `listCollectionsSafe`, `createCollectionSafe`, `collection.getSafe`, `collection.updateSafe`, `collection.deleteSafe`, `collection.querySafe`, `collection.docs.listSafe`, `collection.docs.upsertSafe`, `collection.docs.updateSafe`, `collection.docs.deleteSafe`, `collection.docs.fetchSafe`, `collection.docs.getBulkUpsertSafe`, `collection.docs.bulkUpsertSafe`, `collection.docs.bulkUpsertDocsSafe`. The `Result` type and `OK` / `ERR` helpers are exported from the package.

### Error Classes
**Primary errors:**
* [`LambdaDBError`](./src/models/errors/lambdadberror.ts): The base class for HTTP error responses.
  * [`UnauthenticatedError`](./src/models/errors/unauthenticatederror.ts): Unauthenticated. Status code `401`.
  * [`TooManyRequestsError`](./src/models/errors/toomanyrequestserror.ts): Too many requests. Status code `429`.
  * [`InternalServerError`](./src/models/errors/internalservererror.ts): Internal server error. Status code `500`.
  * [`ResourceNotFoundError`](./src/models/errors/resourcenotfounderror.ts): Resource not found. Status code `404`. *

<details><summary>Less common errors (8)</summary>

<br />

**Network errors:**
* [`ConnectionError`](./src/models/errors/httpclienterrors.ts): HTTP client was unable to make a request to a server.
* [`RequestTimeoutError`](./src/models/errors/httpclienterrors.ts): HTTP request timed out due to an AbortSignal signal.
* [`RequestAbortedError`](./src/models/errors/httpclienterrors.ts): HTTP request was aborted by the client.
* [`InvalidRequestError`](./src/models/errors/httpclienterrors.ts): Any input used to create a request is invalid.
* [`UnexpectedClientError`](./src/models/errors/httpclienterrors.ts): Unrecognised or unexpected error.


**Inherit from [`LambdaDBError`](./src/models/errors/lambdadberror.ts)**:
* [`BadRequestError`](./src/models/errors/badrequesterror.ts): Bad request. Status code `400`. Applicable to 9 of 13 methods.*
* [`ResourceAlreadyExistsError`](./src/models/errors/resourcealreadyexistserror.ts): Resource already exists. Status code `409`. Applicable to 1 of 13 methods.*
* [`ResponseValidationError`](./src/models/errors/responsevalidationerror.ts): Type mismatch between the data returned from the server and the structure expected by the SDK. See `error.rawValue` for the raw value and `error.pretty()` for a nicely formatted multi-line string.

</details>

\* Check [the method documentation](#available-resources-and-operations) to see if the error is applicable.
<!-- End Error Handling [errors] -->

<!-- Start Server Selection [server] -->
## Server Selection (API base URL)

`LambdaDBClient` builds the API base as **`{baseUrl}/projects/{projectName}`**. You can override the defaults when creating the client.

| Option         | Type     | Default                     | Description                          |
| -------------- | -------- | --------------------------- | ------------------------------------ |
| `baseUrl`      | `string` | `"https://api.lambdadb.ai"` | API base URL (no trailing slash).    |
| `projectName`  | `string` | `"playground"`              | Project name (path segment).         |
| `serverURL`    | `string` | —                           | Full base URL (overrides baseUrl + projectName). |
| `projectHost`  | `string` | —                           | Legacy: host path for URL (e.g. `api.lambdadb.ai/projects/my-project`). |

### Using baseUrl and projectName (recommended)

```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
  baseUrl: "https://api.lambdadb.ai",
  projectName: "my-project",
});

const result = await client.listCollections();
```

### Override with full server URL

To set the base URL in one go, use `serverURL`:

```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  serverURL: "https://api.lambdadb.ai/projects/my-project",
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

const result = await client.listCollections();
```
<!-- End Server Selection [server] -->

<!-- Start Custom HTTP Client [http-client] -->
## Custom HTTP Client

The TypeScript SDK makes API calls using an `HTTPClient` that wraps the native
[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). This
client is a thin wrapper around `fetch` and provides the ability to attach hooks
around the request lifecycle that can be used to modify the request or handle
errors and response.

The `HTTPClient` constructor takes an optional `fetcher` argument that can be
used to integrate a third-party HTTP client or when writing tests to mock out
the HTTP client and feed in fixtures.

The following example shows how to use the `"beforeRequest"` hook to to add a
custom header and a timeout to requests and how to use the `"requestError"` hook
to log errors:

```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";
import { HTTPClient } from "@functional-systems/lambdadb/lib/http";

const httpClient = new HTTPClient({
  // fetcher takes a function that has the same signature as native `fetch`.
  fetcher: (request) => {
    return fetch(request);
  }
});

httpClient.addHook("beforeRequest", (request) => {
  const nextRequest = new Request(request, {
    signal: request.signal || AbortSignal.timeout(5000)
  });

  nextRequest.headers.set("x-custom-header", "custom value");

  return nextRequest;
});

httpClient.addHook("requestError", (error, request) => {
  console.group("Request Error");
  console.log("Reason:", `${error}`);
  console.log("Endpoint:", `${request.method} ${request.url}`);
  console.groupEnd();
});

const client = new LambdaDBClient({ httpClient, projectApiKey: "<YOUR_PROJECT_API_KEY>" });
```
<!-- End Custom HTTP Client [http-client] -->

<!-- Start Debugging [debug] -->
## Debugging

You can setup your SDK to emit debug logs for SDK requests and responses.

You can pass a logger that matches `console`'s interface as an SDK option.

> [!WARNING]
> Beware that debug logging will reveal secrets, like API tokens in headers, in log messages printed to a console or files. It's recommended to use this feature only during local development and not in production.

```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({ debugLogger: console, projectApiKey: "<YOUR_PROJECT_API_KEY>" });
```

You can also enable a default debug logger by setting an environment variable `LAMBDADB_DEBUG` to true.
<!-- End Debugging [debug] -->

# Development

## Maturity

This SDK is in beta, and there may be breaking changes between versions without a major version update. Therefore, we recommend pinning usage to a specific package version unless you are intentionally looking for the latest version.

## Contributions

We welcome contributions. The recommended API is implemented in `src/client.ts` (LambdaDBClient, collection-scoped). The rest of `src/` (funcs, models, lib) is maintained manually; see [docs/OPENAPI_UPDATE.md](docs/OPENAPI_UPDATE.md) for how API changes are applied. Feel free to open a PR or an issue. 