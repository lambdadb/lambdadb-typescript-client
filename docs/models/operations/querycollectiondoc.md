# QueryCollectionDoc

## Example Usage

```typescript
import { QueryCollectionDoc } from "lambdadb/models/operations";

let value: QueryCollectionDoc = {};
```

## Fields

| Field                                                                                | Type                                                                                 | Required                                                                             | Description                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `collection`                                                                         | *string*                                                                             | :heavy_minus_sign:                                                                   | Collection name.                                                                     |
| `score`                                                                              | *number*                                                                             | :heavy_minus_sign:                                                                   | Document similarity score.                                                           |
| `doc`                                                                                | [operations.QueryCollectionDocDoc](../../models/operations/querycollectiondocdoc.md) | :heavy_minus_sign:                                                                   | N/A                                                                                  |