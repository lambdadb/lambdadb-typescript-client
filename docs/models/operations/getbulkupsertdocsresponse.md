# GetBulkUpsertDocsResponse

Required info to upload documents.

## Example Usage

```typescript
import { GetBulkUpsertDocsResponse } from "@functional-systems/lambdadb/models/operations";

let value: GetBulkUpsertDocsResponse = {
  url: "https://inborn-technician.biz/",
  objectKey: "<value>",
};
```

## Fields

| Field                                                          | Type                                                           | Required                                                       | Description                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `url`                                                          | *string*                                                       | :heavy_check_mark:                                             | Presigned URL.                                                 |
| `type`                                                         | [operations.Type](../../models/operations/type.md)             | :heavy_minus_sign:                                             | Content type that must be specified when uploading documents.  |
| `httpMethod`                                                   | [operations.HttpMethod](../../models/operations/httpmethod.md) | :heavy_minus_sign:                                             | HTTP method that must be specified when uploading documents.   |
| `objectKey`                                                    | *string*                                                       | :heavy_check_mark:                                             | Object key that must be specified when uploading documents.    |
| `sizeLimitBytes`                                               | *number*                                                       | :heavy_minus_sign:                                             | Object size limit in bytes.                                    |