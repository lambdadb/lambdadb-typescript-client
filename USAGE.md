<!-- Start SDK Example Usage [usage] -->
```typescript
import { LambdaDB } from "@swkim86/lambdadb";

const lambdaDB = new LambdaDB({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDB.projects.collections.listcollections({
    projectName: "<value>",
  });

  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->