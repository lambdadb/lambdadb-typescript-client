# DeleteDocsRequest

## Example Usage

```typescript
import { DeleteDocsRequest } from "lambdadb/models/operations";

let value: DeleteDocsRequest = {
  projectName: "<value>",
  collectionName: "<value>",
};
```

## Fields

| Field                              | Type                               | Required                           | Description                        |
| ---------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| `projectName`                      | *string*                           | :heavy_check_mark:                 | Project name.                      |
| `collectionName`                   | *string*                           | :heavy_check_mark:                 | Collection name.                   |
| `requestBody`                      | *operations.DeleteDocsRequestBody* | :heavy_check_mark:                 | N/A                                |