import assert from "node:assert/strict";
import test from "node:test";

import { Document as LangChainDocument } from "@langchain/core/documents";
import { QdrantVectorStore as LangChainQdrantVectorStore } from "@langchain/qdrant";
import { Settings } from "@llamaindex/core/global";
import { TextNode } from "@llamaindex/core/schema";
import { QdrantVectorStore as LlamaIndexQdrantVectorStore } from "@llamaindex/qdrant";

import { QdrantCompatClient } from "../../dist/esm/compat/qdrant.js";

const shouldRun = process.env.LAMBDADB_RUN_EXTERNAL_INTEGRATION_TESTS === "1";

class StaticEmbeddings {
  async embedDocuments(texts) {
    return texts.map(vectorForText);
  }

  async embedQuery(text) {
    return vectorForText(text);
  }
}

class InMemoryDocs {
  constructor(collection) {
    this.collection = collection;
  }

  async upsert(body) {
    for (const doc of body.docs) {
      this.collection.docs.set(String(doc.id), doc);
    }
    return { message: "ok" };
  }

  async fetch(body) {
    return {
      docs: body.ids
        .map((id) => this.collection.docs.get(String(id)))
        .filter(Boolean)
        .map((doc) => ({ collection: this.collection.name, doc })),
      total: body.ids.length,
      took: 0,
      isDocsInline: true,
    };
  }

  async delete(body) {
    for (const id of body.ids) {
      this.collection.docs.delete(String(id));
    }
    return { message: "ok" };
  }

  async list(body = {}) {
    return {
      docs: Array.from(this.collection.docs.values())
        .slice(0, body.size ?? 10)
        .map((doc) => ({ collection: this.collection.name, doc })),
      isDocsInline: true,
      total: this.collection.docs.size,
    };
  }
}

class InMemoryCollection {
  constructor(owner, name) {
    this.owner = owner;
    this.name = name;
    this.docs = new Map();
    this.docApi = new InMemoryDocs(this);
    this.indexConfigs = {};
  }

  handle() {
    return {
      docs: this.docApi,
      get: async () => ({
        collection: {
          collectionName: this.name,
          indexConfigs: this.indexConfigs,
          numDocs: this.docs.size,
          collectionStatus: "ACTIVE",
        },
      }),
      update: async (body) => {
        this.indexConfigs = body.indexConfigs;
        return { collection: { collectionName: this.name, indexConfigs: this.indexConfigs } };
      },
      delete: async () => {
        this.owner.collections.delete(this.name);
        return { message: "ok" };
      },
      query: async (body) => {
        const knn = body.query.knn;
        const queryVector = knn.queryVector;
        const docs = Array.from(this.docs.values())
          .map((doc) => ({
            collection: this.name,
            doc,
            score: dot(queryVector, doc[knn.field]),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, body.size ?? knn.k ?? 10);
        return {
          docs,
          total: docs.length,
          took: 0,
          isDocsInline: true,
        };
      },
    };
  }
}

class InMemoryLambdaDB {
  constructor() {
    this.collections = new Map();
  }

  async listCollections() {
    return {
      collections: Array.from(this.collections.keys()).map((collectionName) => ({
        collectionName,
      })),
    };
  }

  async createCollection(body) {
    const collection = this.ensureCollection(body.collectionName);
    collection.indexConfigs = body.indexConfigs ?? {};
    return { collection: { collectionName: body.collectionName } };
  }

  collection(name) {
    return this.ensureCollection(name).handle();
  }

  ensureCollection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new InMemoryCollection(this, name));
    }
    return this.collections.get(name);
  }
}

test("langchain qdrant vector store works with QdrantCompatClient", {
  skip: shouldRun ? false : "Set LAMBDADB_RUN_EXTERNAL_INTEGRATION_TESTS=1",
}, async () => {
  Settings.embedModel = {
    getTextEmbedding: async (text) => vectorForText(text),
    getQueryEmbedding: async (text) => vectorForText(text),
  };
  const client = new QdrantCompatClient(new InMemoryLambdaDB());
  const embeddings = new StaticEmbeddings();

  const store = await LangChainQdrantVectorStore.fromDocuments(
    [
      new LangChainDocument({
        pageContent: "alpha",
        metadata: { tenant: "acme" },
      }),
      new LangChainDocument({
        pageContent: "beta",
        metadata: { tenant: "acme" },
      }),
    ],
    embeddings,
    {
      client,
      collectionName: "langchain-docs",
    },
  );

  const results = await store.similaritySearchVectorWithScore([1, 0, 0], 1);

  assert.equal(results.length, 1);
  assert.equal(results[0][0].pageContent, "alpha");
  assert.equal(results[0][0].metadata.tenant, "acme");
});

test("llamaindex qdrant vector store works with QdrantCompatClient", {
  skip: shouldRun ? false : "Set LAMBDADB_RUN_EXTERNAL_INTEGRATION_TESTS=1",
}, async () => {
  const client = new QdrantCompatClient(new InMemoryLambdaDB());
  const store = new LlamaIndexQdrantVectorStore({
    client,
    collectionName: "llamaindex-docs",
  });

  const alpha = new TextNode({
    text: "alpha",
    metadata: { tenant: "acme" },
  });
  alpha.id_ = "alpha";
  alpha.embedding = [1, 0, 0];

  const beta = new TextNode({
    text: "beta",
    metadata: { tenant: "acme" },
  });
  beta.id_ = "beta";
  beta.embedding = [0, 1, 0];

  const ids = await store.add([alpha, beta]);
  assert.deepEqual(ids, ["alpha", "beta"]);

  const results = await store.query({
    queryEmbedding: [1, 0, 0],
    similarityTopK: 1,
  });

  assert.equal(results.ids[0], "alpha");
  assert.equal(results.nodes[0].getContent(), "alpha");
});

function vectorForText(text) {
  if (text.includes("alpha")) return [1, 0, 0];
  if (text.includes("beta")) return [0, 1, 0];
  return [0, 0, 1];
}

function dot(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return 0;
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}
