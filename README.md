# LambdaDB Typescript SDK

Developer-friendly & type-safe Typescript SDK specifically catered to leverage *LambdaDB* API.

<div align="left">
    <a href="https://www.speakeasy.com/?utm_source=lambdadb&utm_campaign=typescript"><img src="https://custom-icon-badges.demolab.com/badge/-Built%20By%20Speakeasy-212015?style=for-the-badge&logoColor=FBE331&logo=speakeasy&labelColor=545454" /></a>
    <a href="https://opensource.org/licenses/MIT">
        <img src="https://img.shields.io/badge/License-MIT-blue.svg" style="width: 100px; height: 28px;" />
    </a>
</div>


<br /><br />
> [!IMPORTANT]
> This SDK is not yet ready for production use. To complete setup please follow the steps outlined in your [workspace](https://app.speakeasy.com/org/lambdadb-ayw/lambdadb-typescript). Delete this section before > publishing to a package manager.

<!-- Start Summary [summary] -->
## Summary

LambdaDB API: LambdaDB Open API Spec
<!-- End Summary [summary] -->

<!-- Start Table of Contents [toc] -->
## Table of Contents
<!-- $toc-max-depth=2 -->
* [LambdaDB Typescript SDK](#lambdadb-typescript-sdk)
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
npm add @swkim86/lambdadb
```

### PNPM

```bash
pnpm add @swkim86/lambdadb
```

### Bun

```bash
bun add @swkim86/lambdadb
```

### Yarn

```bash
yarn add @swkim86/lambdadb zod

# Note that Yarn does not install peer dependencies automatically. You will need
# to install zod as shown above.
```

> [!NOTE]
> This package is published with CommonJS and ES Modules (ESM) support.


### Model Context Protocol (MCP) Server

This SDK is also an installable MCP server where the various SDK methods are
exposed as tools that can be invoked by AI applications.

> Node.js v20 or greater is required to run the MCP server from npm.

<details>
<summary>Claude installation steps</summary>

Add the following server definition to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "LambdaDB": {
      "command": "npx",
      "args": [
        "-y", "--package", "@swkim86/lambdadb",
        "--",
        "mcp", "start",
        "--project-api-key", "..."
      ]
    }
  }
}
```

</details>

<details>
<summary>Cursor installation steps</summary>

Create a `.cursor/mcp.json` file in your project root with the following content:

```json
{
  "mcpServers": {
    "LambdaDB": {
      "command": "npx",
      "args": [
        "-y", "--package", "@swkim86/lambdadb",
        "--",
        "mcp", "start",
        "--project-api-key", "..."
      ]
    }
  }
}
```

</details>

You can also run MCP servers as a standalone binary with no additional dependencies. You must pull these binaries from available Github releases:

```bash
curl -L -o mcp-server \
    https://github.com/{org}/{repo}/releases/download/{tag}/mcp-server-bun-darwin-arm64 && \
chmod +x mcp-server
```

If the repo is a private repo you must add your Github PAT to download a release `-H "Authorization: Bearer {GITHUB_PAT}"`.


```json
{
  "mcpServers": {
    "Todos": {
      "command": "./DOWNLOAD/PATH/mcp-server",
      "args": [
        "start"
      ]
    }
  }
}
```

For a full list of server arguments, run:

```sh
npx -y --package @swkim86/lambdadb -- mcp start --help
```
<!-- End SDK Installation [installation] -->

<!-- Start Requirements [requirements] -->
## Requirements

For supported JavaScript runtimes, please consult [RUNTIMES.md](RUNTIMES.md).
<!-- End Requirements [requirements] -->

<!-- Start SDK Example Usage [usage] -->
## SDK Example Usage

### Example

```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.projects.collections.listcollections({
    projectName: "<value>",
  });

  console.log(result);
}

run();

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
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.projects.collections.listcollections({
    projectName: "<value>",
  });

  console.log(result);
}

run();

```
<!-- End Authentication [security] -->

<!-- Start Available Resources and Operations [operations] -->
## Available Resources and Operations

<details open>
<summary>Available methods</summary>


### [projects](docs/sdks/projects/README.md)


#### [projects.collections](docs/sdks/collections/README.md)

* [listcollections](docs/sdks/collections/README.md#listcollections) - List all collections in an existing project.
* [createCollection](docs/sdks/collections/README.md#createcollection) - Create an collection.
* [deleteCollection](docs/sdks/collections/README.md#deletecollection) - Delete an existing collection.
* [getCollection](docs/sdks/collections/README.md#getcollection) - Get metadata of an existing collection.
* [updateCollection](docs/sdks/collections/README.md#updatecollection) - Configure an collection.
* [queryCollection](docs/sdks/collections/README.md#querycollection) - Search an collection with a query and return the most similar documents.

#### [projects.collections.docs](docs/sdks/docs/README.md)

* [upsertDocs](docs/sdks/docs/README.md#upsertdocs) - Upsert documents into an collection. Note that the maximum supported payload size is 6MB.
* [getBulkUpsertDocs](docs/sdks/docs/README.md#getbulkupsertdocs) - Request required info to upload documents.
* [bulkUpsertDocs](docs/sdks/docs/README.md#bulkupsertdocs) - Bulk upsert documents into an collection. Note that the maximum supported object size is 200MB.
* [deleteDocs](docs/sdks/docs/README.md#deletedocs) - Delete documents by document IDs or query filter from an collection.
* [fetchDocs](docs/sdks/docs/README.md#fetchdocs) - Lookup and return documents by document IDs from an collection.

</details>
<!-- End Available Resources and Operations [operations] -->

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

- [`projectsCollectionsCreateCollection`](docs/sdks/collections/README.md#createcollection) - Create an collection.
- [`projectsCollectionsDeleteCollection`](docs/sdks/collections/README.md#deletecollection) - Delete an existing collection.
- [`projectsCollectionsDocsBulkUpsertDocs`](docs/sdks/docs/README.md#bulkupsertdocs) - Bulk upsert documents into an collection. Note that the maximum supported object size is 200MB.
- [`projectsCollectionsDocsDeleteDocs`](docs/sdks/docs/README.md#deletedocs) - Delete documents by document IDs or query filter from an collection.
- [`projectsCollectionsDocsFetchDocs`](docs/sdks/docs/README.md#fetchdocs) - Lookup and return documents by document IDs from an collection.
- [`projectsCollectionsDocsGetBulkUpsertDocs`](docs/sdks/docs/README.md#getbulkupsertdocs) - Request required info to upload documents.
- [`projectsCollectionsDocsUpsertDocs`](docs/sdks/docs/README.md#upsertdocs) - Upsert documents into an collection. Note that the maximum supported payload size is 6MB.
- [`projectsCollectionsGetCollection`](docs/sdks/collections/README.md#getcollection) - Get metadata of an existing collection.
- [`projectsCollectionsListcollections`](docs/sdks/collections/README.md#listcollections) - List all collections in an existing project.
- [`projectsCollectionsQueryCollection`](docs/sdks/collections/README.md#querycollection) - Search an collection with a query and return the most similar documents.
- [`projectsCollectionsUpdateCollection`](docs/sdks/collections/README.md#updatecollection) - Configure an collection.

</details>
<!-- End Standalone functions [standalone-funcs] -->

<!-- Start Retries [retries] -->
## Retries

Some of the endpoints in this SDK support retries.  If you use the SDK without any configuration, it will fall back to the default retry strategy provided by the API.  However, the default retry strategy can be overridden on a per-operation basis, or across the entire SDK.

To change the default retry strategy for a single API call, simply provide a retryConfig object to the call:
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.projects.collections.listcollections({
    projectName: "<value>",
  }, {
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
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
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
  const result = await lambdaDB.projects.collections.listcollections({
    projectName: "<value>",
  });

  console.log(result);
}

run();

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

### Example
```typescript
import { LambdaDB } from "@swkim86/lambdadb";
import * as errors from "@swkim86/lambdadb/models/errors";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  try {
    const result = await lambdaDB.projects.collections.listcollections({
      projectName: "<value>",
    });

    console.log(result);
  } catch (error) {
    // The base class for HTTP error responses
    if (error instanceof errors.LambdaDBError) {
      console.log(error.message);
      console.log(error.statusCode);
      console.log(error.body);
      console.log(error.headers);

      // Depending on the method different errors may be thrown
      if (error instanceof errors.UnauthenticatedError) {
        console.log(error.data$.message); // string
      }
    }
  }
}

run();

```

### Error Classes
**Primary errors:**
* [`LambdaDBError`](./src/models/errors/lambdadberror.ts): The base class for HTTP error responses.
  * [`UnauthenticatedError`](docs/models/errors/unauthenticatederror.md): Unauthenticated. Status code `401`.
  * [`TooManyRequestsError`](docs/models/errors/toomanyrequestserror.md): Too many requests. Status code `429`.
  * [`InternalServerError`](docs/models/errors/internalservererror.md): Internal server error. Status code `500`.
  * [`ResourceNotFoundError`](docs/models/errors/resourcenotfounderror.md): Resource not found. Status code `404`. *

<details><summary>Less common errors (8)</summary>

<br />

**Network errors:**
* [`ConnectionError`](./src/models/errors/httpclienterrors.ts): HTTP client was unable to make a request to a server.
* [`RequestTimeoutError`](./src/models/errors/httpclienterrors.ts): HTTP request timed out due to an AbortSignal signal.
* [`RequestAbortedError`](./src/models/errors/httpclienterrors.ts): HTTP request was aborted by the client.
* [`InvalidRequestError`](./src/models/errors/httpclienterrors.ts): Any input used to create a request is invalid.
* [`UnexpectedClientError`](./src/models/errors/httpclienterrors.ts): Unrecognised or unexpected error.


**Inherit from [`LambdaDBError`](./src/models/errors/lambdadberror.ts)**:
* [`BadRequestError`](docs/models/errors/badrequesterror.md): Bad request. Status code `400`. Applicable to 7 of 11 methods.*
* [`ResourceAlreadyExistsError`](docs/models/errors/resourcealreadyexistserror.md): Resource already exists. Status code `409`. Applicable to 1 of 11 methods.*
* [`ResponseValidationError`](./src/models/errors/responsevalidationerror.ts): Type mismatch between the data returned from the server and the structure expected by the SDK. See `error.rawValue` for the raw value and `error.pretty()` for a nicely formatted multi-line string.

</details>

\* Check [the method documentation](#available-resources-and-operations) to see if the error is applicable.
<!-- End Error Handling [errors] -->

<!-- Start Server Selection [server] -->
## Server Selection

### Override Server URL Per-Client

The default server can be overridden globally by passing a URL to the `serverURL: string` optional parameter when initializing the SDK client instance. For example:
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  serverURL: "https://{baseUrl}",
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.projects.collections.listcollections({
    projectName: "<value>",
  });

  console.log(result);
}

run();

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
import { LambdaDB } from "@swkim86/lambdadb";
import { HTTPClient } from "@swkim86/lambdadb/lib/http";

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

const sdk = new LambdaDB({ httpClient });
```
<!-- End Custom HTTP Client [http-client] -->

<!-- Start Debugging [debug] -->
## Debugging

You can setup your SDK to emit debug logs for SDK requests and responses.

You can pass a logger that matches `console`'s interface as an SDK option.

> [!WARNING]
> Beware that debug logging will reveal secrets, like API tokens in headers, in log messages printed to a console or files. It's recommended to use this feature only during local development and not in production.

```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const sdk = new LambdaDB({ debugLogger: console });
```

You can also enable a default debug logger by setting an environment variable `LAMBDADB_DEBUG` to true.
<!-- End Debugging [debug] -->

<!-- Placeholder for Future Speakeasy SDK Sections -->

# Development

## Maturity

This SDK is in beta, and there may be breaking changes between versions without a major version update. Therefore, we recommend pinning usage
to a specific package version. This way, you can install the same version each time without breaking changes unless you are intentionally
looking for the latest version.

## Contributions

While we value open-source contributions to this SDK, this library is generated programmatically. Any manual changes added to internal files will be overwritten on the next generation. 
We look forward to hearing your feedback. Feel free to open a PR or an issue with a proof of concept and we'll do our best to include it in a future release. 
