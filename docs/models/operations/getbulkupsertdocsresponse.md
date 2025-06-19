# GetBulkUpsertDocsResponse

Required info to upload documents.

## Example Usage

```typescript
import { GetBulkUpsertDocsResponse } from "lambdadb/models/operations";

let value: GetBulkUpsertDocsResponse = {};
```

## Fields

| Field                                                          | Type                                                           | Required                                                       | Description                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `url`                                                          | *string*                                                       | :heavy_minus_sign:                                             | Presigned URL.                                                 |
| `type`                                                         | [operations.Type](../../models/operations/type.md)             | :heavy_minus_sign:                                             | Content type that must be specified when uploading documents.  |
| `httpMethod`                                                   | [operations.HttpMethod](../../models/operations/httpmethod.md) | :heavy_minus_sign:                                             | HTTP method that must be specified when uploading documents.   |
| `objectKey`                                                    | *string*                                                       | :heavy_minus_sign:                                             | Object key that must be specified when uploading documents.    |
| `sizeLimitBytes`                                               | *number*                                                       | :heavy_minus_sign:                                             | Object size limit in bytes.                                    |