# DeleteDocsRequestBody

## Example Usage

```typescript
import { DeleteDocsRequestBody } from "@functional-systems/lambdadb/models/operations";

let value: DeleteDocsRequestBody = {};
```

## Fields

| Field                                                     | Type                                                      | Required                                                  | Description                                               |
| --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `ids`                                                     | *string*[]                                                | :heavy_minus_sign:                                        | A list of document IDs.                                   |
| `filter`                                                  | Record<string, *any*>                                     | :heavy_minus_sign:                                        | Query filter.                                             |
| `partitionFilter`                                         | [models.PartitionFilter](../../models/partitionfilter.md) | :heavy_minus_sign:                                        | N/A                                                       |