# GetBulkUpsertDocsRequest

## Example Usage

```typescript
import { GetBulkUpsertDocsRequest } from "@functional-systems/lambdadb/models/operations";

let value: GetBulkUpsertDocsRequest = {
  collectionName: "<value>",
};
```

## Fields

| Field              | Type               | Required           | Description        |
| ------------------ | ------------------ | ------------------ | ------------------ |
| `collectionName`   | *string*           | :heavy_check_mark: | Collection name.   |
| `branch`           | *string*           | :heavy_minus_sign: | Write target Branch; defaults to `main`. |
