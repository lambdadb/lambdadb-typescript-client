import dotenv from "dotenv";
dotenv.config();

import {
  LambdaDBClient,
  aliasRef,
  branchRef,
  branchSource,
  tagRef,
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

  // A successful write is accepted before it is committed. Poll an ordinary
  // (non-consistent) Branch read before creating a Tag.
  let committed = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await collection.docs.fetch({
      ids: ["doc-1"],
      ref: branchRef("candidate"),
    });
    if (result.docs.some(({ doc }) => doc.id === "doc-1")) {
      committed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (!committed) throw new Error("candidate data was not committed in time");

  await collection.tags.create({
    tagName: "release-001",
    source: branchSource("candidate"),
  });
  await collection.aliases.create({
    aliasName: "production",
    target: tagTarget("release-001"),
  });

  await collection.docs.fetch({
    ids: ["doc-1"],
    ref: aliasRef("production"),
  });

  // Use the immutable Tag on every page for a stable export.
  for await (const page of collection.docs.listPages({
    size: 50,
    ref: tagRef("release-001"),
  })) {
    console.log(page.docs);
  }
}

main().catch(console.error);
