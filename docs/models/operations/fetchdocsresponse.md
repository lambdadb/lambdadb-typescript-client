# FetchDocsResponse

Fetched documents.

## Example Usage

```typescript
import { FetchDocsResponse } from "@swkim86/lambdadb/models/operations";

let value: FetchDocsResponse = {};
```

## Fields

| Field                                                                | Type                                                                 | Required                                                             | Description                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `total`                                                              | *number*                                                             | :heavy_minus_sign:                                                   | Total number of documents returned.                                  |
| `took`                                                               | *number*                                                             | :heavy_minus_sign:                                                   | Elapsed time in milliseconds.                                        |
| `docs`                                                               | [operations.FetchDocsDoc](../../models/operations/fetchdocsdoc.md)[] | :heavy_minus_sign:                                                   | N/A                                                                  |