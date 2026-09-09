# DeleteDocsRequestBody

## Example Usage

```typescript
import { DeleteDocsRequestBody } from "@functional-systems/lambdadb/models/operations";

const value: DeleteDocsRequestBody = {
  ids: ["doc-1"],
  branch: "candidate",
};
```

## Fields

| Field                                                     | Type                                                      | Required                                                  | Description                                               |
| --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `ids`                                                     | *string*[]                                                | Conditional                                               | A list of document IDs; mutually exclusive with `filter`. |
| `filter`                                                  | Record<string, *any*>                                     | Conditional                                               | Query filter; mutually exclusive with `ids`.              |
| `partitionFilter`                                         | [models.PartitionFilter](../../models/partitionfilter.md) | :heavy_minus_sign:                                        | Narrows `ids` or `filter`; invalid by itself.              |
| `branch`                                                  | *string*                                                  | :heavy_minus_sign:                                        | Write target Branch; defaults to `main`.                   |

Specify exactly one of `ids` or `filter`.
