import dotenv from "dotenv";
dotenv.config();

/**
 * Example: collection-scoped API — get a collection handle once, then call
 * methods without passing collectionName every time.
 *
 * Run from the examples directory:
 *   npm run build && npx tsx collectionScoped.example.ts
 */

import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY ?? "<YOUR_PROJECT_API_KEY>",
});

const COLLECTION_NAME = "my-collection";

async function main() {
  const collection = client.collection(COLLECTION_NAME);

  // Collection metadata
  const meta = await collection.get();
  console.log("Collection:", meta);

  // List documents (no collectionName in the call)
  const { docs, total, nextPageToken } = await collection.docs.list({ size: 10 });
  console.log(`Documents: ${docs.length} of ${total}`, nextPageToken ? "(has more)" : "");
}

main().catch(console.error);
