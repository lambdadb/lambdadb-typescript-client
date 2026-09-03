import dotenv from "dotenv";
dotenv.config();

import {
  LambdaDBClient,
  aliasRef,
  branchSource,
  tagTarget,
} from "@functional-systems/lambdadb";

const client = new LambdaDBClient({
  baseUrl: process.env.LAMBDADB_BASE_URL ?? "https://api.lambdadb.ai",
  projectApiKey: process.env.LAMBDADB_PROJECT_API_KEY ?? "<YOUR_PROJECT_API_KEY>",
  projectName: process.env.LAMBDADB_PROJECT_NAME ?? "playground",
});

async function main() {
  const collection = client.collection("my-collection");

  await collection.branches.create({
    branchName: "candidate",
    source: branchSource("main"),
  });
  await collection.docs.upsert({
    branch: "candidate",
    docs: [{ id: "doc-1", text: "Candidate content" }],
  });
  await collection.tags.create({
    tagName: "release-001",
    source: branchSource("candidate"),
  });
  await collection.aliases.create({
    aliasName: "production",
    target: tagTarget("release-001"),
  });

  for await (const page of collection.docs.listPages({
    size: 50,
    ref: aliasRef("production"),
  })) {
    console.log(page.docs);
  }
}

main().catch(console.error);
