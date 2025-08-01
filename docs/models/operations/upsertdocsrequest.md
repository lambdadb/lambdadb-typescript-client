# UpsertDocsRequest

## Example Usage

```typescript
import { UpsertDocsRequest } from "@swkim86/lambdadb/models/operations";

let value: UpsertDocsRequest = {
  collectionName: "<value>",
  requestBody: {
    docs: [],
  },
};
```

## Fields

| Field                                                                                | Type                                                                                 | Required                                                                             | Description                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `collectionName`                                                                     | *string*                                                                             | :heavy_check_mark:                                                                   | Collection name.                                                                     |
| `requestBody`                                                                        | [operations.UpsertDocsRequestBody](../../models/operations/upsertdocsrequestbody.md) | :heavy_check_mark:                                                                   | N/A                                                                                  |