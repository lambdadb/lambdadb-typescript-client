# PartitionFilter

## Example Usage

```typescript
import { PartitionFilter } from "@functional-systems/lambdadb/models";

let value: PartitionFilter = {
  field: "<value>",
  in: [
    "<value 1>",
    "<value 2>",
    "<value 3>",
  ],
};
```

## Fields

| Field                       | Type                        | Required                    | Description                 |
| --------------------------- | --------------------------- | --------------------------- | --------------------------- |
| `field`                     | *string*                    | :heavy_check_mark:          | Partition field name.       |
| `in`                        | *string*[]                  | :heavy_check_mark:          | Partition values to filter. |