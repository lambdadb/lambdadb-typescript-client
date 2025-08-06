<!-- Start SDK Example Usage [usage] -->
```typescript
import { LambdaDB } from "@functional-systems/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.collections.list();

  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->