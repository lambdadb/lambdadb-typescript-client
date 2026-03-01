# Collections.Docs

## Overview

> **Deprecated API.** The examples below use the **deprecated** client (`LambdaDB`, `lambdaDB.collections.docs.*`). For new code, use **LambdaDBClient** and `client.collection(name).docs` instead. See the [main README](../../../README.md) for recommended usage and [Server selection (API base URL)](../../../README.md#server-selection-api-base-url) for **baseUrl** / **projectName** configuration.

### Available Operations

* [listDocs](#listdocs) - List documents in a collection.
* [upsert](#upsert) - Upsert documents into a collection. Note that the maximum supported payload size is 6MB.
* [bulkUpsertDocs](#bulkupsertdocs) - Bulk upsert documents in one call (up to 200MB); recommended when you have a document list.
* [getBulkUpsert](#getbulkupsert) - Request required info to upload documents.
* [bulkUpsert](#bulkupsert) - Bulk upsert documents into a collection. Note that the maximum supported object size is 200MB.
* [update](#update) - Update documents in a collection. Note that the maximum supported payload size is 6MB.
* [delete](#delete) - Delete documents by document IDs or query filter from a collection.
* [fetch](#fetch) - Lookup and return documents by document IDs from a collection.

## listDocs

List documents in a collection.

When using **LambdaDBClient**, `collection.docs.list()` and `collection.docs.listSafe()` automatically fetch documents from the presigned URL when the API returns `isDocsInline: false`, so the response always includes `docs`.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listDocs" method="get" path="/collections/{collectionName}/docs" -->
```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.listDocs({
    collectionName: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@functional-systems/lambdadb/core.js";
import { collectionsDocsListDocs } from "@functional-systems/lambdadb/funcs/collectionsDocsListDocs.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsListDocs(lambdaDB, {
    collectionName: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsListDocs failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.ListDocsRequest](../../models/operations/listdocsrequest.md)                                                                                                       | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.ListDocsResponse](../../models/operations/listdocsresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.BadRequestError       | 400                          | application/json             |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## upsert

Upsert documents into a collection. Note that the maximum supported payload size is 6MB.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="upsertDocs" method="post" path="/collections/{collectionName}/docs/upsert" -->
```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.upsert({
    collectionName: "<value>",
    requestBody: {
      docs: [
        {
          "example-field1": "example-value1",
          "example-field2": [
            0.1,
            0.2,
            0.3,
          ],
        },
        {
          "example-field1": "example-value2",
          "example-field2": [
            0.4,
            0.5,
            0.6,
          ],
        },
      ],
    },
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@functional-systems/lambdadb/core.js";
import { collectionsDocsUpsert } from "@functional-systems/lambdadb/funcs/collectionsDocsUpsert.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsUpsert(lambdaDB, {
    collectionName: "<value>",
    requestBody: {
      docs: [
        {
          "example-field1": "example-value1",
          "example-field2": [
            0.1,
            0.2,
            0.3,
          ],
        },
        {
          "example-field1": "example-value2",
          "example-field2": [
            0.4,
            0.5,
            0.6,
          ],
        },
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsUpsert failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.UpsertDocsRequest](../../models/operations/upsertdocsrequest.md)                                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[models.MessageResponse](../../models/messageresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.BadRequestError       | 400                          | application/json             |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## getBulkUpsert

Request required info to upload documents.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="getBulkUpsertDocs" method="get" path="/collections/{collectionName}/docs/bulk-upsert" -->
```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.getBulkUpsert({
    collectionName: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@functional-systems/lambdadb/core.js";
import { collectionsDocsGetBulkUpsert } from "@functional-systems/lambdadb/funcs/collectionsDocsGetBulkUpsert.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsGetBulkUpsert(lambdaDB, {
    collectionName: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsGetBulkUpsert failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.GetBulkUpsertDocsRequest](../../models/operations/getbulkupsertdocsrequest.md)                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.GetBulkUpsertDocsResponse](../../models/operations/getbulkupsertdocsresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## bulkUpsert

Bulk upsert documents into a collection. Note that the maximum supported object size is 200MB.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="bulkUpsertDocs" method="post" path="/collections/{collectionName}/docs/bulk-upsert" -->
```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.bulkUpsert({
    collectionName: "<value>",
    requestBody: {
      objectKey: "example-object-key",
    },
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@functional-systems/lambdadb/core.js";
import { collectionsDocsBulkUpsert } from "@functional-systems/lambdadb/funcs/collectionsDocsBulkUpsert.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsBulkUpsert(lambdaDB, {
    collectionName: "<value>",
    requestBody: {
      objectKey: "example-object-key",
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsBulkUpsert failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.BulkUpsertDocsRequest](../../models/operations/bulkupsertdocsrequest.md)                                                                                           | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[models.MessageResponse](../../models/messageresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.BadRequestError       | 400                          | application/json             |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## bulkUpsertDocs

Bulk upsert documents in one call (up to 200MB). This method abstracts the flow of getBulkUpsert, uploading to the presigned URL, and calling bulkUpsert. Use it when you have a document array and want a single-call API; use getBulkUpsert + bulkUpsert for low-level control (e.g. custom upload).

**Available on the collection-scoped client only:** `LambdaDBClient` → `client.collection(collectionName).docs.bulkUpsertDocs(...)`.

### Example Usage

```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const collection = client.collection("my-collection");
  const result = await collection.docs.bulkUpsertDocs({
    docs: [
      { id: "1", text: "First document" },
      { id: "2", text: "Second document" },
    ],
  });
  console.log(result);
}

run();
```

### Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `body` | `{ docs: Array<Record<string, unknown>> }` | Yes | The documents to bulk upsert. |
| `options` | RequestOptions | No | Request options (e.g. retries, timeout). |

### Response

**Promise\<[models.MessageResponse](../../models/messageresponse.md)\>**

### Errors

Errors can be thrown from: getBulkUpsert (API errors), upload (e.g. payload exceeds size limit or S3 PUT failure), or bulkUpsert (API errors).

## update

Update documents in a collection. Note that the maximum supported payload size is 6MB.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="updateDocs" method="post" path="/collections/{collectionName}/docs/update" -->
```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.update({
    collectionName: "<value>",
    requestBody: {
      docs: [
        {
          "id": "example-id1",
          "example-field1": "example-value1",
          "example-field2": [
            0.1,
            0.2,
            0.3,
          ],
        },
        {
          "id": "example-id2",
          "example-field1": "example-value2",
          "example-field2": [
            0.4,
            0.5,
            0.6,
          ],
        },
      ],
    },
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@functional-systems/lambdadb/core.js";
import { collectionsDocsUpdate } from "@functional-systems/lambdadb/funcs/collectionsDocsUpdate.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsUpdate(lambdaDB, {
    collectionName: "<value>",
    requestBody: {
      docs: [
        {
          "id": "example-id1",
          "example-field1": "example-value1",
          "example-field2": [
            0.1,
            0.2,
            0.3,
          ],
        },
        {
          "id": "example-id2",
          "example-field1": "example-value2",
          "example-field2": [
            0.4,
            0.5,
            0.6,
          ],
        },
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsUpdate failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.UpdateDocsRequest](../../models/operations/updatedocsrequest.md)                                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[models.MessageResponse](../../models/messageresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.BadRequestError       | 400                          | application/json             |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## delete

Delete documents by document IDs or query filter from a collection.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="deleteDocs" method="post" path="/collections/{collectionName}/docs/delete" -->
```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.delete({
    collectionName: "<value>",
    requestBody: {
      ids: [
        "example-doc-id-1",
        "example-doc-id-2",
      ],
    },
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@functional-systems/lambdadb/core.js";
import { collectionsDocsDelete } from "@functional-systems/lambdadb/funcs/collectionsDocsDelete.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsDelete(lambdaDB, {
    collectionName: "<value>",
    requestBody: {
      ids: [
        "example-doc-id-1",
        "example-doc-id-2",
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsDelete failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.DeleteDocsRequest](../../models/operations/deletedocsrequest.md)                                                                                                   | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[models.MessageResponse](../../models/messageresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.BadRequestError       | 400                          | application/json             |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## fetch

Lookup and return documents by document IDs from a collection.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="fetchDocs" method="post" path="/collections/{collectionName}/docs/fetch" -->
```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.fetch({
    collectionName: "<value>",
    requestBody: {
      ids: [
        "example-doc-id-1",
        "example-doc-id-2",
      ],
    },
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@functional-systems/lambdadb/core.js";
import { collectionsDocsFetch } from "@functional-systems/lambdadb/funcs/collectionsDocsFetch.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsFetch(lambdaDB, {
    collectionName: "<value>",
    requestBody: {
      ids: [
        "example-doc-id-1",
        "example-doc-id-2",
      ],
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsFetch failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.FetchDocsRequest](../../models/operations/fetchdocsrequest.md)                                                                                                     | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.FetchDocsResponse](../../models/operations/fetchdocsresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.BadRequestError       | 400                          | application/json             |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |