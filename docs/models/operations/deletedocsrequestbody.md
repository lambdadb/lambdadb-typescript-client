# DeleteDocsRequestBody

## Example Usage

```typescript
import { DeleteDocsRequestBody } from "lambdadb/models/operations";

let value: DeleteDocsRequestBody = {};
```

## Fields

| Field                   | Type                    | Required                | Description             |
| ----------------------- | ----------------------- | ----------------------- | ----------------------- |
| `ids`                   | *string*[]              | :heavy_minus_sign:      | A list of document IDs. |
| `filter`                | Record<string, *any*>   | :heavy_minus_sign:      | Query filter.           |