<!-- Start SDK Example Usage [usage] -->
```typescript
import { LambdaDb } from "lambdadb";

const lambdaDb = new LambdaDb({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
});

async function run() {
  const result = await lambdaDb.projects.collections.listcollections({
    projectName: "<value>",
  });

  console.log(result);
}

run();

```
<!-- End SDK Example Usage [usage] -->