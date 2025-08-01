# Collections
(*collections*)

## Overview

### Available Operations

* [listCollections](#listcollections) - List all collections in an existing project.
* [createCollection](#createcollection) - Create a collection.
* [deleteCollection](#deletecollection) - Delete an existing collection.
* [getCollection](#getcollection) - Get metadata of an existing collection.
* [updateCollection](#updatecollection) - Configure a collection.
* [queryCollection](#querycollection) - Search a collection with a query and return the most similar documents.

## listCollections

List all collections in an existing project.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="listCollections" method="get" path="/collections" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.listCollections();

  console.log(result);
}

run();
```

### Standalone function

The standalone function version of this method:

```typescript
import { LambdaDBCore } from "@swkim86/lambdadb/core.js";
import { collectionsListCollections } from "@swkim86/lambdadb/funcs/collectionsListCollections.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsListCollections(lambdaDB);
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsListCollections failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.ListCollectionsResponse](../../models/operations/listcollectionsresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## createCollection

Create a collection.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="createCollection" method="post" path="/collections" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.createCollection({
    collectionName: "example-collection-name",
    indexConfigs: {
      "example-field1": {
        type: "text",
        analyzers: [
          "english",
        ],
      },
      "example-field2": {
        type: "vector",
        dimensions: 128,
        similarity: "cosine",
      },
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
import { collectionsCreateCollection } from "@swkim86/lambdadb/funcs/collectionsCreateCollection.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsCreateCollection(lambdaDB, {
    collectionName: "example-collection-name",
    indexConfigs: {
      "example-field1": {
        type: "text",
        analyzers: [
          "english",
        ],
      },
      "example-field2": {
        type: "vector",
        dimensions: 128,
        similarity: "cosine",
      },
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsCreateCollection failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.CreateCollectionRequest](../../models/operations/createcollectionrequest.md)                                                                                       | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.CreateCollectionResponse](../../models/operations/createcollectionresponse.md)\>**

### Errors

| Error Type                        | Status Code                       | Content Type                      |
| --------------------------------- | --------------------------------- | --------------------------------- |
| errors.BadRequestError            | 400                               | application/json                  |
| errors.UnauthenticatedError       | 401                               | application/json                  |
| errors.ResourceAlreadyExistsError | 409                               | application/json                  |
| errors.TooManyRequestsError       | 429                               | application/json                  |
| errors.InternalServerError        | 500                               | application/json                  |
| errors.LambdaDBDefaultError       | 4XX, 5XX                          | \*/\*                             |

## deleteCollection

Delete an existing collection.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="deleteCollection" method="delete" path="/collections/{collectionName}" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.deleteCollection({
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
import { collectionsDeleteCollection } from "@swkim86/lambdadb/funcs/collectionsDeleteCollection.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsDeleteCollection(lambdaDB, {
    collectionName: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsDeleteCollection failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.DeleteCollectionRequest](../../models/operations/deletecollectionrequest.md)                                                                                       | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[models.MessageResponse](../../models/messageresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## getCollection

Get metadata of an existing collection.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="getCollection" method="get" path="/collections/{collectionName}" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.getCollection({
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
import { collectionsGetCollection } from "@swkim86/lambdadb/funcs/collectionsGetCollection.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsGetCollection(lambdaDB, {
    collectionName: "<value>",
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsGetCollection failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.GetCollectionRequest](../../models/operations/getcollectionrequest.md)                                                                                             | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.GetCollectionResponse](../../models/operations/getcollectionresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## updateCollection

Configure a collection.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="updateCollection" method="patch" path="/collections/{collectionName}" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.updateCollection({
    collectionName: "<value>",
    requestBody: {
      indexConfigs: {
        "example-field1": {
          type: "text",
          analyzers: [
            "english",
          ],
        },
        "example-field2": {
          type: "vector",
          dimensions: 128,
          similarity: "cosine",
        },
        "example-field3": {
          type: "keyword",
        },
      },
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
import { collectionsUpdateCollection } from "@swkim86/lambdadb/funcs/collectionsUpdateCollection.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsUpdateCollection(lambdaDB, {
    collectionName: "<value>",
    requestBody: {
      indexConfigs: {
        "example-field1": {
          type: "text",
          analyzers: [
            "english",
          ],
        },
        "example-field2": {
          type: "vector",
          dimensions: 128,
          similarity: "cosine",
        },
        "example-field3": {
          type: "keyword",
        },
      },
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsUpdateCollection failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.UpdateCollectionRequest](../../models/operations/updatecollectionrequest.md)                                                                                       | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.UpdateCollectionResponse](../../models/operations/updatecollectionresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.BadRequestError       | 400                          | application/json             |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |

## queryCollection

Search a collection with a query and return the most similar documents.

### Example Usage

<!-- UsageSnippet language="typescript" operationID="queryCollection" method="post" path="/collections/{collectionName}/query" -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.queryCollection({
    collectionName: "<value>",
    requestBody: {
      size: 2,
      query: {
        "queryString": {
          "query": "example-field1:example-value",
        },
      },
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
import { collectionsQueryCollection } from "@swkim86/lambdadb/funcs/collectionsQueryCollection.js";

// Use `LambdaDBCore` for best tree-shaking performance.
// You can create one instance of it to use across an application.
const lambdaDB = new LambdaDBCore({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const res = await collectionsQueryCollection(lambdaDB, {
    collectionName: "<value>",
    requestBody: {
      size: 2,
      query: {
        "queryString": {
          "query": "example-field1:example-value",
        },
      },
    },
  });
  if (res.ok) {
    const { value: result } = res;
    console.log(result);
  } else {
    console.log("collectionsQueryCollection failed:", res.error);
  }
}

run();
```

### Parameters

| Parameter                                                                                                                                                                      | Type                                                                                                                                                                           | Required                                                                                                                                                                       | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request`                                                                                                                                                                      | [operations.QueryCollectionRequest](../../models/operations/querycollectionrequest.md)                                                                                         | :heavy_check_mark:                                                                                                                                                             | The request object to use for the request.                                                                                                                                     |
| `options`                                                                                                                                                                      | RequestOptions                                                                                                                                                                 | :heavy_minus_sign:                                                                                                                                                             | Used to set various options for making HTTP requests.                                                                                                                          |
| `options.fetchOptions`                                                                                                                                                         | [RequestInit](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#options)                                                                                        | :heavy_minus_sign:                                                                                                                                                             | Options that are passed to the underlying HTTP request. This can be used to inject extra headers for examples. All `Request` options, except `method` and `body`, are allowed. |
| `options.retries`                                                                                                                                                              | [RetryConfig](../../lib/utils/retryconfig.md)                                                                                                                                  | :heavy_minus_sign:                                                                                                                                                             | Enables retrying HTTP requests under certain failure conditions.                                                                                                               |

### Response

**Promise\<[operations.QueryCollectionResponse](../../models/operations/querycollectionresponse.md)\>**

### Errors

| Error Type                   | Status Code                  | Content Type                 |
| ---------------------------- | ---------------------------- | ---------------------------- |
| errors.BadRequestError       | 400                          | application/json             |
| errors.UnauthenticatedError  | 401                          | application/json             |
| errors.ResourceNotFoundError | 404                          | application/json             |
| errors.TooManyRequestsError  | 429                          | application/json             |
| errors.InternalServerError   | 500                          | application/json             |
| errors.LambdaDBDefaultError  | 4XX, 5XX                     | \*/\*                        |