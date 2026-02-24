<!-- Start SDK Example Usage [usage] -->
```typescript
import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: "<YOUR_PROJECT_API_KEY>",
  // Optional: baseUrl (default "https://api.lambdadb.ai"), projectName (default "playground")
});

async function run() {
  const result = await client.listCollections();
  console.log(result);

  const collection = client.collection("my-collection");
  await collection.docs.list({ size: 20 });
}

run();
```
<!-- End SDK Example Usage [usage] -->