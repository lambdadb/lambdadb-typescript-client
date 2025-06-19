# IndexConfigsText

## Example Usage

```typescript
import { IndexConfigsText } from "lambdadb";

let value: IndexConfigsText = {
  type: "text",
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `type`                                     | [models.TypeText](../models/typetext.md)   | :heavy_check_mark:                         | N/A                                        |
| `analyzers`                                | [models.Analyzer](../models/analyzer.md)[] | :heavy_minus_sign:                         | Analyzers.                                 |