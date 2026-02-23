import dotenv from "dotenv";
dotenv.config();

/**
 * Example: list collections using the recommended LambdaDBClient.
 *
 * Run from the examples directory:
 *   npm run build && npx tsx collectionsList.example.ts
 */

import { LambdaDBClient } from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY ?? "<YOUR_PROJECT_API_KEY>",
});

async function main() {
  const result = await client.listCollections();
  console.log(result);
}

main().catch(console.error);
