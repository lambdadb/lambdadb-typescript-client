# Docs
(*collections.docs*)

## Overview

### Available Operations

* [upsertDocs](#upsertdocs) - Upsert documents into a collection. Note that the maximum supported payload size is 6MB.
* [getBulkUpsertDocs](#getbulkupsertdocs) - Request required info to upload documents.
* [bulkUpsertDocs](#bulkupsertdocs) - Bulk upsert documents into a collection. Note that the maximum supported object size is 200MB.
* [updateDocs](#updatedocs) - Update documents in a collection. Note that the maximum supported payload size is 6MB.
* [deleteDocs](#deletedocs) - Delete documents by document IDs or query filter from a collection.
* [fetchDocs](#fetchdocs) - Lookup and return documents by document IDs from a collection.

## upsertDocs

Upsert documents into a collection. Note that the maximum supported payload size is 6MB.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="upsertDocs" method="post" path="/collections/{collectionName}/docs/upsert" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.upsertDocs({
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
import { LambdaDBCore } from "@swkim86/lambdadb/core.js";
import { collectionsDocsUpsertDocs } from "@swkim86/lambdadb/funcs/collectionsDocsUpsertDocs.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsUpsertDocs(lambdaDB, {
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
    console.log("collectionsDocsUpsertDocs failed:", res.error);
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

## getBulkUpsertDocs

Request required info to upload documents.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="getBulkUpsertDocs" method="get" path="/collections/{collectionName}/docs/bulk-upsert" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.getBulkUpsertDocs({
    collectionName: "<value>",
  });

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@swkim86/lambdadb/core.js";
import { collectionsDocsGetBulkUpsertDocs } from "@swkim86/lambdadb/funcs/collectionsDocsGetBulkUpsertDocs.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsGetBulkUpsertDocs(lambdaDB, {
    collectionName: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsGetBulkUpsertDocs failed:", res.error);
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

## bulkUpsertDocs

Bulk upsert documents into a collection. Note that the maximum supported object size is 200MB.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="bulkUpsertDocs" method="post" path="/collections/{collectionName}/docs/bulk-upsert" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.bulkUpsertDocs({
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
import { LambdaDBCore } from "@swkim86/lambdadb/core.js";
import { collectionsDocsBulkUpsertDocs } from "@swkim86/lambdadb/funcs/collectionsDocsBulkUpsertDocs.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsBulkUpsertDocs(lambdaDB, {
    collectionName: "<value>",
    requestBody: {
      objectKey: "example-object-key",
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDocsBulkUpsertDocs failed:", res.error);
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

## updateDocs

Update documents in a collection. Note that the maximum supported payload size is 6MB.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="updateDocs" method="post" path="/collections/{collectionName}/docs/update" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.updateDocs({
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
import { LambdaDBCore } from "@swkim86/lambdadb/core.js";
import { collectionsDocsUpdateDocs } from "@swkim86/lambdadb/funcs/collectionsDocsUpdateDocs.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsUpdateDocs(lambdaDB, {
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
    console.log("collectionsDocsUpdateDocs failed:", res.error);
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

## deleteDocs

Delete documents by document IDs or query filter from a collection.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="deleteDocs" method="post" path="/collections/{collectionName}/docs/delete" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.deleteDocs({
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
import { LambdaDBCore } from "@swkim86/lambdadb/core.js";
import { collectionsDocsDeleteDocs } from "@swkim86/lambdadb/funcs/collectionsDocsDeleteDocs.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsDeleteDocs(lambdaDB, {
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
    console.log("collectionsDocsDeleteDocs failed:", res.error);
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

## fetchDocs

Lookup and return documents by document IDs from a collection.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="fetchDocs" method="post" path="/collections/{collectionName}/docs/fetch" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.docs.fetchDocs({
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
import { LambdaDBCore } from "@swkim86/lambdadb/core.js";
import { collectionsDocsFetchDocs } from "@swkim86/lambdadb/funcs/collectionsDocsFetchDocs.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDocsFetchDocs(lambdaDB, {
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
    console.log("collectionsDocsFetchDocs failed:", res.error);
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