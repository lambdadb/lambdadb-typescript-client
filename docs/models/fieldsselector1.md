# FieldsSelector1

## Example Usage

```typescript
import { FieldsSelector1 } from "@functional-systems/lambdadb/models";

let value: FieldsSelector1 = {
  include: [
    "<value 1>",
  ],
};
```

## Fields

| Field                                         | Type                                          | Required                                      | Description                                   |
| --------------------------------------------- | --------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| `include`                                     | *string*[]                                    | :heavy_check_mark:                            | List of field names to include in the result. |
| `exclude`                                     | *string*[]                                    | :heavy_minus_sign:                            | List of field names to exclude in the result. |