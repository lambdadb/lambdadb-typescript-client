import {
  Distance,
  PointStruct,
  SparseVector,
  VectorParams,
  type DenseVector,
  type PointId,
} from "./models.js";
import * as models from "./models.js";
import {
  QdrantCompatValidationError,
  UnsupportedQdrantFeatureError,
} from "./errors.js";

export const DEFAULT_VECTOR_NAME = "_qdrant_vector";
export const ID_FIELD = "id";
export const ORIGINAL_ID_FIELD = "_qdrant_id";
export const RESERVED_PREFIX = "_qdrant_";

type JsonObject = { [key: string]: unknown };
type IndexConfig = { [key: string]: unknown };
type IndexConfigs = { [fieldName: string]: IndexConfig };

const payloadSchemaTypeAliases: { [schemaType: string]: string } = {
  keyword: "keyword",
  integer: "long",
  int: "long",
  long: "long",
  float: "double",
  double: "double",
  bool: "boolean",
  boolean: "boolean",
  datetime: "datetime",
  text: "text",
  uuid: "keyword",
};

export function vectorFieldName(name?: string | null): string {
  if (name == null || name === "") return DEFAULT_VECTOR_NAME;
  return `${DEFAULT_VECTOR_NAME}_${String(name).replaceAll(".", "_")}`;
}

export function pointFromAny(point: unknown): PointStruct {
  if (point instanceof PointStruct) return point;
  if (isObject(point) && "id" in point && "vector" in point) {
    return new PointStruct(point as {
      id: PointId;
      vector: models.PointVector;
      payload?: JsonObject | null;
    });
  }
  throw new QdrantCompatValidationError(`Unsupported point type: ${typeof point}`);
}

export function pointsToDocs(points: Iterable<unknown>): JsonObject[] {
  return Array.from(points, pointToDoc);
}

export function pointToDoc(point: unknown): JsonObject {
  const item = pointFromAny(point);
  const payload = { ...(item.payload ?? {}) };
  validatePayload(payload);

  const doc: JsonObject = {
    [ID_FIELD]: String(item.id),
    [ORIGINAL_ID_FIELD]: item.id,
    ...payload,
  };

  if (isDenseVector(item.vector)) {
    doc[DEFAULT_VECTOR_NAME] = item.vector;
    return doc;
  }

  if (isObject(item.vector)) {
    for (const [name, vector] of Object.entries(item.vector)) {
      if (isSparseVectorLike(vector)) {
        throw new UnsupportedQdrantFeatureError(
          "Sparse vectors are not supported in v1 Qdrant compatibility upsert",
        );
      }
      if (!isDenseVector(vector)) {
        throw new QdrantCompatValidationError(
          "Named point vectors must be dense vector arrays",
        );
      }
      doc[vectorFieldName(name)] = vector;
    }
    return doc;
  }

  throw new QdrantCompatValidationError(
    "Point vector must be a dense vector array or named vector object",
  );
}

export function docToRecord(
  input: unknown,
  options: { withPayload?: boolean; withVectors?: boolean } = {},
): models.Record {
  const doc = unwrapDoc(input);
  return new models.Record({
    id: docId(doc),
    payload: options.withPayload === false ? undefined : payloadFromDoc(doc),
    vector: vectorFromDoc(doc, options.withVectors === true),
  });
}

export function resultToScoredPoint(
  result: unknown,
  options: { withPayload?: boolean; withVectors?: boolean } = {},
): models.ScoredPoint {
  const doc = unwrapDoc(result);
  const score = isObject(result) && typeof result["score"] === "number"
    ? result["score"]
    : undefined;
  return new models.ScoredPoint({
    id: docId(doc),
    score,
    payload: options.withPayload === false ? undefined : payloadFromDoc(doc),
    vector: vectorFromDoc(doc, options.withVectors === true),
  });
}

export function vectorConfigToIndexConfigs(vectorsConfig: unknown): IndexConfigs {
  if (isVectorParamsLike(vectorsConfig)) {
    const params = vectorParamsFromAny(vectorsConfig);
    return {
      [DEFAULT_VECTOR_NAME]: {
        type: "vector",
        dimensions: params.size,
        similarity: distanceToSimilarity(params.distance),
      },
    };
  }

  if (isObject(vectorsConfig)) {
    if ("size" in vectorsConfig) {
      return vectorConfigToIndexConfigs(vectorParamsFromAny(vectorsConfig));
    }

    const indexConfigs: IndexConfigs = {};
    for (const [name, rawParams] of Object.entries(vectorsConfig)) {
      const params = vectorParamsFromAny(rawParams);
      indexConfigs[vectorFieldName(name)] = {
        type: "vector",
        dimensions: params.size,
        similarity: distanceToSimilarity(params.distance),
      };
    }
    return indexConfigs;
  }

  throw new QdrantCompatValidationError(
    "vectorsConfig must be VectorParams or a mapping of vector names",
  );
}

export function payloadSchemaToIndexConfigs(payloadSchema?: unknown): IndexConfigs {
  if (payloadSchema == null) return {};
  if (!isObject(payloadSchema)) {
    throw new QdrantCompatValidationError(
      "payloadSchema must be a mapping of payload field names to schema types",
    );
  }

  const indexConfigs: IndexConfigs = {};
  for (const [fieldName, rawSchema] of Object.entries(payloadSchema)) {
    validatePayloadFieldName(fieldName);
    indexConfigs[fieldName] = { type: payloadSchemaType(rawSchema) };
  }
  return indexConfigs;
}

export function mergeIndexConfigs(...configs: IndexConfigs[]): IndexConfigs {
  const merged: IndexConfigs = {};
  for (const config of configs) {
    for (const [fieldName, indexConfig] of Object.entries(config)) {
      if (
        fieldName in merged &&
        JSON.stringify(merged[fieldName]) !== JSON.stringify(indexConfig)
      ) {
        throw new QdrantCompatValidationError(
          `Conflicting index config for field ${fieldName}`,
        );
      }
      merged[fieldName] = { ...indexConfig };
    }
  }
  return merged;
}

export function queryVectorAndField(
  query: unknown,
  using?: string,
): { vector: DenseVector; field: string } {
  if (isDenseVector(query)) {
    return { vector: query, field: vectorFieldName(using) };
  }

  if (Array.isArray(query) && query.length === 2 && typeof query[0] === "string") {
    const vector = query[1];
    if (!isDenseVector(vector)) {
      throw new UnsupportedQdrantFeatureError(
        "Only dense vector arrays are supported in v1",
      );
    }
    return { vector, field: vectorFieldName(query[0]) };
  }

  if (isObject(query)) {
    if ("nearest" in query) {
      return queryVectorAndField(query["nearest"], using);
    }
    if ("vector" in query) {
      const rawVector = query["vector"];
      if (isObject(rawVector) && "name" in rawVector && "vector" in rawVector) {
        const namedVector = rawVector["vector"];
        if (!isDenseVector(namedVector)) {
          throw new UnsupportedQdrantFeatureError(
            "Only dense vector arrays are supported in v1",
          );
        }
        return { vector: namedVector, field: vectorFieldName(String(rawVector["name"])) };
      }
      if (!isDenseVector(rawVector)) {
        throw new UnsupportedQdrantFeatureError(
          "Only dense vector arrays are supported in v1",
        );
      }
      return { vector: rawVector, field: vectorFieldName(using) };
    }
  }

  throw new UnsupportedQdrantFeatureError(
    "Only dense vector queryPoints/search inputs are supported in v1",
  );
}

export function plainIndexConfigs(rawIndexConfigs: unknown): IndexConfigs {
  if (!isObject(rawIndexConfigs)) return {};
  const result: IndexConfigs = {};
  for (const [fieldName, rawIndexConfig] of Object.entries(rawIndexConfigs)) {
    if (!isObject(rawIndexConfig)) continue;
    const normalized: IndexConfig = {};
    for (const [key, value] of Object.entries(rawIndexConfig)) {
      if (value !== undefined && value !== null) normalized[key] = value;
    }
    result[fieldName] = normalized;
  }
  return result;
}

export function qdrantVectorsConfig(indexConfigs: IndexConfigs): unknown {
  let unnamedVector: VectorParams | undefined;
  const namedVectors: { [name: string]: VectorParams } = {};

  for (const [fieldName, indexConfig] of Object.entries(indexConfigs)) {
    if (indexConfig["type"] !== "vector") continue;
    const params = new VectorParams({
      size: Number(indexConfig["dimensions"]),
      distance: similarityToDistance(indexConfig["similarity"]),
    });
    if (fieldName === DEFAULT_VECTOR_NAME) {
      unnamedVector = params;
    } else if (fieldName.startsWith(`${DEFAULT_VECTOR_NAME}_`)) {
      namedVectors[fieldName.slice(DEFAULT_VECTOR_NAME.length + 1)] = params;
    }
  }

  if (unnamedVector !== undefined && Object.keys(namedVectors).length === 0) {
    return unnamedVector;
  }
  if (unnamedVector !== undefined) {
    namedVectors[""] = unnamedVector;
  }
  return namedVectors;
}

export function validatePayloadFieldName(key: string): void {
  if (key.startsWith(RESERVED_PREFIX)) {
    throw new QdrantCompatValidationError(
      `Payload field ${key} uses reserved prefix ${RESERVED_PREFIX}`,
    );
  }
  if (key === ID_FIELD) {
    throw new QdrantCompatValidationError(
      "Payload field 'id' conflicts with the Qdrant point id",
    );
  }
}

export function distanceToSimilarity(distance: models.Distance | string): string {
  if (distance === Distance.COSINE || distance === "cosine") return "cosine";
  if (distance === Distance.EUCLID || distance === "euclidean") return "euclidean";
  if (distance === Distance.DOT || distance === "dot_product") return "dot_product";
  throw new UnsupportedQdrantFeatureError(
    `Qdrant distance ${String(distance)} is not supported`,
  );
}

function vectorParamsFromAny(value: unknown): VectorParams {
  if (value instanceof VectorParams) return value;
  if (isObject(value) && "size" in value) {
    const init: { size: number; distance?: string | undefined } = {
      size: Number(value["size"]),
    };
    if (typeof value["distance"] === "string") init.distance = value["distance"];
    return new VectorParams(init);
  }
  throw new QdrantCompatValidationError(
    "vectorsConfig values must be VectorParams-like objects",
  );
}

function similarityToDistance(similarity: unknown): models.Distance {
  const value = similarity ?? "cosine";
  if (value === "cosine") return Distance.COSINE;
  if (value === "euclidean") return Distance.EUCLID;
  if (value === "dot_product") return Distance.DOT;
  throw new UnsupportedQdrantFeatureError(
    `LambdaDB similarity ${String(value)} cannot be represented as a Qdrant distance`,
  );
}

function payloadSchemaType(rawSchema: unknown): string {
  let rawType: string;
  if (typeof rawSchema === "string") {
    rawType = rawSchema;
  } else if (isObject(rawSchema) && "type" in rawSchema) {
    rawType = String(rawSchema["type"]);
  } else {
    throw new QdrantCompatValidationError(
      `Unsupported payload schema value: ${String(rawSchema)}`,
    );
  }

  const normalized = rawType.toLowerCase();
  if (normalized === "geo") {
    throw new UnsupportedQdrantFeatureError(
      "Geo payload indexes are not supported by LambdaDB Qdrant compatibility",
    );
  }
  const mapped = payloadSchemaTypeAliases[normalized];
  if (mapped === undefined) {
    throw new UnsupportedQdrantFeatureError(
      `Unsupported Qdrant payload schema type: ${rawType}`,
    );
  }
  return mapped;
}

function validatePayload(payload: JsonObject): void {
  for (const key of Object.keys(payload)) {
    validatePayloadFieldName(key);
  }
}

function payloadFromDoc(doc: JsonObject): JsonObject {
  const payload: JsonObject = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key !== ID_FIELD && !key.startsWith(RESERVED_PREFIX)) {
      payload[key] = value;
    }
  }
  return payload;
}

function vectorFromDoc(doc: JsonObject, withVectors: boolean): unknown {
  if (!withVectors) return undefined;

  const named: JsonObject = {};
  let defaultVector: unknown;
  for (const [key, value] of Object.entries(doc)) {
    if (key === DEFAULT_VECTOR_NAME) {
      defaultVector = value;
    } else if (key.startsWith(`${DEFAULT_VECTOR_NAME}_`)) {
      named[key.slice(DEFAULT_VECTOR_NAME.length + 1)] = value;
    }
  }

  if (Object.keys(named).length > 0) {
    if (defaultVector !== undefined) named[""] = defaultVector;
    return named;
  }
  return defaultVector;
}

function docId(doc: JsonObject): PointId {
  const originalId = doc[ORIGINAL_ID_FIELD];
  if (typeof originalId === "string" || typeof originalId === "number") {
    return originalId;
  }
  const id = doc[ID_FIELD];
  if (typeof id === "string" || typeof id === "number") return id;
  return "";
}

function unwrapDoc(input: unknown): JsonObject {
  if (isObject(input) && isObject(input["doc"])) return input["doc"];
  if (isObject(input)) return input;
  throw new QdrantCompatValidationError("LambdaDB result doc must be an object");
}

function isVectorParamsLike(value: unknown): boolean {
  return value instanceof VectorParams || (isObject(value) && "size" in value);
}

function isDenseVector(value: unknown): value is DenseVector {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isSparseVectorLike(value: unknown): boolean {
  return value instanceof SparseVector ||
    (isObject(value) && Array.isArray(value["indices"]) && Array.isArray(value["values"]));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { IndexConfigs };
