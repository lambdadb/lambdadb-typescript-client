# IndexConfigsText

## Example Usage

```typescript
import { IndexConfigsText } from "@functional-systems/lambdadb/models";

let value: IndexConfigsText = {
  type: "text",
  analyzers: ["chinese", "cjk"],
};
```

## Fields

| Field                                      | Type                                       | Required                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `type`                                     | *"text"*                                   | :heavy_check_mark:                         | N/A                                        |
| `analyzers`                                | [models.Analyzer](../models/analyzer.md)[] | :heavy_minus_sign:                         | Text analyzers applied independently. Omit for the server default `["standard"]`.                                 |

The SDK leaves omitted `analyzers` out of the request. An empty array does not
select the default. Arrays retain their order and duplicates; use lowercase
names and avoid duplicates when configuring new fields. Selecting multiple
analyzers does not enable automatic language detection.

See [Choose text analyzers](https://docs.lambdadb.ai/guides/collections/choose-text-analyzers)
for Chinese word segmentation, CJK character pairs, and selection tradeoffs.
