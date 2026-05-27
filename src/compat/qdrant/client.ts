import { LambdaDBClient, type LambdaDBClientOptions } from "../../client.js";
import { ResourceNotFoundError } from "../../models/errors/index.js";
import type { CreateCollectionInput, ListDocsInput } from "../../types/public.js";
import {
  ORIGINAL_ID_FIELD,
  mergeIndexConfigs,
  payloadSchemaToIndexConfigs,
  plainIndexConfigs,
  pointsToDocs,
  qdrantVectorsConfig,
  queryVectorAndField,
  resultToScoredPoint,
  docToRecord,
  vectorFieldName,
  vectorConfigToIndexConfigs,
  type IndexConfigs,
} from "./conversions.js";
import { filterToLambdaDB } from "./filters.js";
import * as models from "./models.js";
import {
  QdrantCompatError,
  QdrantCompatValidationError,
  UnsupportedQdrantFeatureError,
} from "./errors.js";

type JsonObject = { [key: string]: unknown };
type ListDocsBody = ListDocsInput;

type CollectionLike = {
  get(): Promise<{ collection: JsonObject }>;
  update(body: { indexConfigs: IndexConfigs }): Promise<unknown>;
  delete(): Promise<unknown>;
  query(body: JsonObject): Promise<{ docs: unknown[] }>;
  docs: {
    upsert(body: { docs: JsonObject[] }): Promise<unknown>;
    fetch(body: JsonObject): Promise<{ docs: unknown[] }>;
    delete(body: { ids?: string[]; filter?: JsonObject }): Promise<unknown>;
    list(body?: ListDocsBody): Promise<{
      docs: unknown[];
      nextPageToken?: string | undefined;
    }>;
  };
};

type LambdaDBLike = {
  createCollection(request: CreateCollectionInput): Promise<unknown>;
  listCollections?(): Promise<{ collections: Array<{ collectionName?: string; name?: string }> }>;
  collection(name: string): CollectionLike;
};

type CompatConstructorOptions = LambdaDBClientOptions & {
  project_api_key?: string | undefined;
  apiKey?: string | undefined;
  api_key?: string | undefined;
  base_url?: string | undefined;
  project_name?: string | undefined;
  url?: string | undefined;
  timeout?: number | undefined;
  path?: string | undefined;
  location?: string | undefined;
  host?: string | undefined;
  port?: number | undefined;
  https?: boolean | undefined;
  prefix?: string | undefined;
  [key: string]: unknown;
};

type CreateCollectionOptions = {
  vectorsConfig?: unknown;
  vectors_config?: unknown;
  payloadSchema?: unknown;
  payload_schema?: unknown;
  payloadIndexes?: unknown;
  payload_indexes?: unknown;
  payloadIndexConfigs?: unknown;
  payload_index_configs?: unknown;
  timeout?: number | undefined;
  initFrom?: unknown;
  init_from?: unknown;
  [key: string]: unknown;
};

type QueryPointsOptions = {
  query: unknown;
  queryFilter?: models.Filter | JsonObject | null;
  query_filter?: models.Filter | JsonObject | null;
  limit?: number | undefined;
  withPayload?: PayloadSelector | undefined;
  with_payload?: PayloadSelector | undefined;
  withVectors?: VectorSelector | undefined;
  with_vectors?: VectorSelector | undefined;
  using?: string | undefined;
  searchParams?: models.SearchParams | JsonObject | null;
  search_params?: models.SearchParams | JsonObject | null;
  offset?: number | undefined;
  scoreThreshold?: number | undefined;
  score_threshold?: number | undefined;
  consistency?: unknown;
  shardKeySelector?: unknown;
  shard_key_selector?: unknown;
  [key: string]: unknown;
};

type PayloadSelector = boolean | string[];
type VectorSelector = boolean | string[];

export class QdrantCompatClient {
  private readonly client: LambdaDBLike;

  constructor(clientOrOptions?: LambdaDBLike | CompatConstructorOptions) {
    if (isLambdaDBLike(clientOrOptions)) {
      this.client = clientOrOptions;
      return;
    }
    this.client = new LambdaDBClient(normalizeConstructorOptions(clientOrOptions));
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      await this.client.collection(collectionName).get();
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  async collection_exists(collectionName: string): Promise<boolean> {
    return this.collectionExists(collectionName);
  }

  async getCollection(collectionName: string): Promise<JsonObject> {
    const collection = await this.currentCollection(collectionName);
    const indexConfigs = plainIndexConfigs(collection["indexConfigs"]);
    return {
      config: {
        params: {
          vectors: qdrantVectorsConfig(indexConfigs),
          sparseVectors: {},
          sparse_vectors: {},
        },
      },
      collectionName,
      collection_name: collectionName,
    };
  }

  async get_collection(collectionName: string): Promise<JsonObject> {
    return this.getCollection(collectionName);
  }

  async getCollections(): Promise<{ collections: Array<{ name: string }> }> {
    if (typeof this.client.listCollections !== "function") {
      return { collections: [] };
    }
    const response = await this.client.listCollections();
    return {
      collections: response.collections
        .map((collection) => collection.name ?? collection.collectionName)
        .filter((name): name is string => typeof name === "string")
        .map((name) => ({ name })),
    };
  }

  async createCollection(
    collectionNameOrInput: string | (CreateCollectionOptions & {
      collectionName?: string;
      collection_name?: string;
    }),
    options: CreateCollectionOptions = {},
  ): Promise<boolean> {
    const { collectionName, body } = normalizeCollectionArgs(collectionNameOrInput, options);
    const payloadSchema = popPayloadSchema(body);
    rejectResultChanging(body, new Set(["timeout", "initFrom", "init_from"]));
    const vectorsConfig = body.vectorsConfig ?? body.vectors_config ?? body["vectors"];
    if (vectorsConfig === undefined) {
      throw new QdrantCompatValidationError("vectorsConfig is required");
    }
    const indexConfigs = mergeIndexConfigs(
      vectorConfigToIndexConfigs(vectorsConfig),
      payloadSchemaToIndexConfigs(payloadSchema),
    );
    await this.client.createCollection({
      collectionName,
      indexConfigs: indexConfigs as CreateCollectionInput["indexConfigs"],
    });
    await this.waitForCollectionActive(collectionName, body.timeout);
    return true;
  }

  async create_collection(
    collectionNameOrInput: Parameters<QdrantCompatClient["createCollection"]>[0],
    options?: Parameters<QdrantCompatClient["createCollection"]>[1],
  ): Promise<boolean> {
    return this.createCollection(collectionNameOrInput, options);
  }

  async recreateCollection(
    collectionNameOrInput: string | (CreateCollectionOptions & {
      collectionName?: string;
      collection_name?: string;
    }),
    options: CreateCollectionOptions = {},
  ): Promise<boolean> {
    const { collectionName } = normalizeCollectionArgs(collectionNameOrInput, options);
    if (await this.collectionExists(collectionName)) {
      await this.deleteCollection(collectionName);
    }
    return this.createCollection(collectionNameOrInput, options);
  }

  async recreate_collection(
    collectionNameOrInput: Parameters<QdrantCompatClient["recreateCollection"]>[0],
    options?: Parameters<QdrantCompatClient["recreateCollection"]>[1],
  ): Promise<boolean> {
    return this.recreateCollection(collectionNameOrInput, options);
  }

  async deleteCollection(collectionName: string): Promise<boolean> {
    await this.client.collection(collectionName).delete();
    return true;
  }

  async delete_collection(collectionName: string): Promise<boolean> {
    return this.deleteCollection(collectionName);
  }

  async createPayloadIndex(
    collectionName: string,
    fieldName: string,
    fieldSchema: unknown,
    options: {
      wait?: boolean | undefined;
      timeout?: number | undefined;
      [key: string]: unknown;
    } = {},
  ): Promise<boolean> {
    const { timeout, wait, ...rest } = options;
    if (wait === false) {
      warn("wait=false is accepted but LambdaDB index updates follow LambdaDB semantics");
    }
    warnIgnored(rest);

    const collection = await this.currentCollection(collectionName);
    const existingIndexConfigs = plainIndexConfigs(collection["indexConfigs"]);
    const payloadIndexConfig = payloadSchemaToIndexConfigs({ [fieldName]: fieldSchema });
    if (hasSameIndexConfigs(existingIndexConfigs, payloadIndexConfig)) return true;

    const numDocs = typeof collection["numDocs"] === "number" ? collection["numDocs"] : 0;
    if (numDocs > 0) {
      throw new UnsupportedQdrantFeatureError(
        "createPayloadIndex is only supported for empty LambdaDB collections. " +
          "Declare payloadSchema during createCollection or reingest documents after adding the index.",
      );
    }

    await this.client.collection(collectionName).update({
      indexConfigs: mergeIndexConfigs(existingIndexConfigs, payloadIndexConfig),
    });
    await this.waitForCollectionActive(collectionName, timeout);
    return true;
  }

  async create_payload_index(
    collectionName: string,
    fieldName: string,
    fieldSchema: unknown,
    options?: Parameters<QdrantCompatClient["createPayloadIndex"]>[3],
  ): Promise<boolean> {
    return this.createPayloadIndex(collectionName, fieldName, fieldSchema, options);
  }

  async upsert(
    collectionName: string,
    options: {
      points: Iterable<unknown>;
      wait?: boolean | undefined;
      [key: string]: unknown;
    },
  ): Promise<models.UpdateResult> {
    const { points, wait, ...rest } = options;
    warnIgnored(rest);
    if (wait === false) {
      warn("wait=false is accepted but LambdaDB write visibility follows LambdaDB semantics");
    }
    await this.client.collection(collectionName).docs.upsert({
      docs: pointsToDocs(points),
    });
    return new models.UpdateResult({ status: models.UpdateStatus.COMPLETED });
  }

  async uploadPoints(
    collectionName: string,
    options: {
      points: Iterable<unknown>;
      batchSize?: number | undefined;
      batch_size?: number | undefined;
      wait?: boolean | undefined;
      parallel?: number | undefined;
      maxRetries?: number | undefined;
      max_retries?: number | undefined;
      shardKeySelector?: unknown;
      shard_key_selector?: unknown;
      [key: string]: unknown;
    },
  ): Promise<void> {
    const {
      points,
      batchSize,
      batch_size: batchSizeSnake,
      wait,
      shardKeySelector,
      shard_key_selector: shardKeySelectorSnake,
      ...rest
    } = options;
    if (shardKeySelector !== undefined || shardKeySelectorSnake !== undefined) {
      throw new UnsupportedQdrantFeatureError(
        "Qdrant shard key routing is not supported in v1",
      );
    }
    warnIgnored(rest);
    const effectiveBatchSize = batchSize ?? batchSizeSnake ?? 64;
    let batch: unknown[] = [];
    for (const point of points) {
      batch.push(point);
      if (batch.length >= effectiveBatchSize) {
        const upsertOptions: { points: Iterable<unknown>; wait?: boolean | undefined } = {
          points: batch,
        };
        if (wait !== undefined) upsertOptions.wait = wait;
        await this.upsert(collectionName, upsertOptions);
        batch = [];
      }
    }
    if (batch.length > 0) {
      const upsertOptions: { points: Iterable<unknown>; wait?: boolean | undefined } = {
        points: batch,
      };
      if (wait !== undefined) upsertOptions.wait = wait;
      await this.upsert(collectionName, upsertOptions);
    }
  }

  async upload_points(
    collectionName: string,
    options: Parameters<QdrantCompatClient["uploadPoints"]>[1],
  ): Promise<void> {
    return this.uploadPoints(collectionName, options);
  }

  async uploadCollection(
    collectionName: string,
    options: {
      vectors: Iterable<unknown>;
      ids?: Iterable<models.PointId> | undefined;
      payload?: Iterable<JsonObject | null | undefined> | undefined;
      batchSize?: number | undefined;
      batch_size?: number | undefined;
      [key: string]: unknown;
    },
  ): Promise<void> {
    const { vectors, ids, payload, batchSize, batch_size: batchSizeSnake, ...rest } = options;
    warnIgnored(rest);
    const vectorList = Array.from(vectors);
    const idList = ids ? Array.from(ids) : vectorList.map((_, index) => index);
    const payloadList = payload
      ? Array.from(payload)
      : vectorList.map(() => undefined);
    if (vectorList.length !== idList.length || vectorList.length !== payloadList.length) {
      throw new QdrantCompatValidationError(
        "vectors, ids, and payload must have the same length",
      );
    }
    const points = vectorList.map((vector, index) => {
      const pointInit: {
        id: models.PointId;
        vector: models.PointVector;
        payload?: JsonObject | null | undefined;
      } = {
        id: idList[index] ?? index,
        vector: vector as models.PointVector,
      };
      const pointPayload = payloadList[index];
      if (pointPayload !== undefined && pointPayload !== null) {
        pointInit.payload = pointPayload;
      }
      return new models.PointStruct(pointInit);
    });
    const uploadOptions: Parameters<QdrantCompatClient["uploadPoints"]>[1] = {
      points,
    };
    const effectiveBatchSize = batchSize ?? batchSizeSnake;
    if (effectiveBatchSize !== undefined) uploadOptions.batchSize = effectiveBatchSize;
    await this.uploadPoints(collectionName, uploadOptions);
  }

  async upload_collection(
    collectionName: string,
    options: Parameters<QdrantCompatClient["uploadCollection"]>[1],
  ): Promise<void> {
    return this.uploadCollection(collectionName, options);
  }

  async retrieve(
    collectionName: string,
    options: {
      ids: models.PointId[];
      withPayload?: PayloadSelector | undefined;
      with_payload?: PayloadSelector | undefined;
      withVectors?: VectorSelector | undefined;
      with_vectors?: VectorSelector | undefined;
      [key: string]: unknown;
    },
  ): Promise<models.Record[]> {
    const {
      ids,
      withPayload,
      with_payload: withPayloadSnake,
      withVectors,
      with_vectors: withVectorsSnake,
      ...rest
    } = options;
    warnIgnored(rest);
    const payloadSelector = normalizePayloadSelector(withPayload ?? withPayloadSnake ?? true);
    const vectorSelector = normalizeVectorSelector(withVectors ?? withVectorsSnake ?? false);
    const fetchBody: JsonObject = {
      ids: ids.map(String),
      consistentRead: true,
      includeVectors: vectorSelector !== false,
    };
    const fields = fieldsForSelectors(payloadSelector, vectorSelector);
    if (fields !== undefined) fetchBody["fields"] = fields;
    const response = await this.client.collection(collectionName).docs.fetch(fetchBody);
    return response.docs.map((doc) => docToRecord(doc, {
      withPayload: payloadSelector,
      withVectors: vectorSelector,
    }));
  }

  async delete(
    collectionName: string,
    options: {
      pointsSelector?: unknown;
      points_selector?: unknown;
      points?: unknown;
      ids?: unknown;
      filter?: models.Filter | JsonObject | null;
      wait?: boolean | undefined;
      [key: string]: unknown;
    } = {},
  ): Promise<models.UpdateResult> {
    const {
      pointsSelector,
      points_selector: pointsSelectorSnake,
      points,
      ids: idsOption,
      filter,
      wait,
      ...rest
    } = options;
    warnIgnored(rest);
    const selector = pointsSelector ?? pointsSelectorSnake ?? points ?? idsOption;
    const ids = idsFromSelector(selector);
    const convertedFilter = filterToLambdaDB(filterFromSelector(selector) ?? filter);
    if (ids === undefined && Object.keys(convertedFilter).length === 0) {
      throw new UnsupportedQdrantFeatureError(
        "delete requires point IDs or a supported Qdrant filter",
      );
    }
    if (wait === false) {
      warn("wait=false is accepted but LambdaDB write visibility follows LambdaDB semantics");
    }
    const body: { ids?: string[]; filter?: JsonObject } = {};
    if (ids !== undefined) body.ids = ids.map(String);
    if (Object.keys(convertedFilter).length > 0) body.filter = convertedFilter;
    await this.client.collection(collectionName).docs.delete(body);
    return new models.UpdateResult({ status: models.UpdateStatus.COMPLETED });
  }

  async queryPoints(
    collectionName: string,
    options: QueryPointsOptions,
  ): Promise<models.QueryResponse> {
    const {
      query,
      queryFilter,
      query_filter: queryFilterSnake,
      limit = 10,
      withPayload,
      with_payload: withPayloadSnake,
      withVectors,
      with_vectors: withVectorsSnake,
      using,
      searchParams,
      search_params: searchParamsSnake,
      offset,
      scoreThreshold,
      score_threshold: scoreThresholdSnake,
      consistency,
      shardKeySelector,
      shard_key_selector: shardKeySelectorSnake,
      ...rest
    } = options;
    warnIgnored(rest);
    if (offset !== undefined && offset !== 0) {
      throw new UnsupportedQdrantFeatureError("Query offset is not supported in v1");
    }
    if (scoreThreshold !== undefined || scoreThresholdSnake !== undefined) {
      throw new UnsupportedQdrantFeatureError(
        "Query scoreThreshold is not supported in v1",
      );
    }
    if (shardKeySelector !== undefined || shardKeySelectorSnake !== undefined) {
      throw new UnsupportedQdrantFeatureError(
        "Qdrant shard key routing is not supported in v1",
      );
    }
    if (consistency !== undefined) {
      warn("Qdrant consistency is ignored; LambdaDB queryPoints uses consistentRead=true");
    }
    if (searchParams !== undefined || searchParamsSnake !== undefined) {
      warn("Qdrant searchParams are ignored by the LambdaDB compatibility client");
    }

    const payloadSelector = normalizePayloadSelector(withPayload ?? withPayloadSnake ?? true);
    const vectorSelector = normalizeVectorSelector(withVectors ?? withVectorsSnake ?? false);
    const { vector, field } = queryVectorAndField(query, using);
    const knn: JsonObject = {
      field,
      k: limit,
      queryVector: vector,
    };
    const convertedFilter = filterToLambdaDB(queryFilter ?? queryFilterSnake);
    if (Object.keys(convertedFilter).length > 0) knn["filter"] = convertedFilter;

    const queryBody: JsonObject = {
      query: { knn },
      size: limit,
      consistentRead: true,
      includeVectors: vectorSelector !== false,
    };
    const fields = fieldsForSelectors(payloadSelector, vectorSelector);
    if (fields !== undefined) queryBody["fields"] = fields;
    const response = await this.client.collection(collectionName).query(queryBody);
    return new models.QueryResponse({
      points: response.docs.map((result) => resultToScoredPoint(result, {
        withPayload: payloadSelector,
        withVectors: vectorSelector,
      })),
    });
  }

  async query_points(
    collectionName: string,
    options: Parameters<QdrantCompatClient["queryPoints"]>[1],
  ): Promise<models.QueryResponse> {
    return this.queryPoints(collectionName, options);
  }

  async query(
    collectionName: string,
    options: {
      query: unknown;
      limit?: number | undefined;
      filter?: models.Filter | JsonObject | null;
      with_payload?: PayloadSelector | undefined;
      withPayload?: PayloadSelector | undefined;
      with_vector?: VectorSelector | undefined;
      withVectors?: VectorSelector | undefined;
      params?: unknown;
      [key: string]: unknown;
    },
  ): Promise<models.QueryResponse> {
    const {
      query,
      limit,
      filter,
      with_payload: withPayloadSnake,
      withPayload,
      with_vector: withVectorSnake,
      withVectors,
      params,
      ...rest
    } = options;
    warnIgnored(rest);
    const queryOptions: QueryPointsOptions = {
      query,
    };
    if (filter !== undefined) queryOptions.queryFilter = filter;
    if (limit !== undefined) queryOptions.limit = limit;
    const payloadSelector = normalizeOptionalPayloadSelector(withPayload ?? withPayloadSnake);
    if (payloadSelector !== undefined) queryOptions.withPayload = payloadSelector;
    const vectorSelector = normalizeOptionalVectorSelector(withVectors ?? withVectorSnake);
    if (vectorSelector !== undefined) queryOptions.withVectors = vectorSelector;
    if (isObject(params)) queryOptions.searchParams = params;
    return this.queryPoints(collectionName, queryOptions);
  }

  async search(
    collectionName: string,
    options: Omit<QueryPointsOptions, "query"> & {
      queryVector?: unknown;
      query_vector?: unknown;
    },
  ): Promise<models.ScoredPoint[]> {
    const query = options.queryVector ?? options.query_vector;
    if (query === undefined) {
      throw new QdrantCompatValidationError("queryVector is required");
    }
    const response = await this.queryPoints(collectionName, { ...options, query });
    return response.points;
  }

  async scroll(
    collectionName: string,
    options: {
      scrollFilter?: models.Filter | JsonObject | null;
      scroll_filter?: models.Filter | JsonObject | null;
      offset?: string | number | undefined;
      limit?: number | undefined;
      withPayload?: PayloadSelector | undefined;
      with_payload?: PayloadSelector | undefined;
      withVectors?: VectorSelector | undefined;
      with_vectors?: VectorSelector | undefined;
      [key: string]: unknown;
    } = {},
  ): Promise<[models.Record[], string | undefined]> {
    const {
      scrollFilter,
      scroll_filter: scrollFilterSnake,
      offset,
      limit = 10,
      withPayload,
      with_payload: withPayloadSnake,
      withVectors,
      with_vectors: withVectorsSnake,
      ...rest
    } = options;
    warnIgnored(rest);
    if (offset !== undefined && typeof offset !== "string") {
      throw new UnsupportedQdrantFeatureError(
        "Qdrant point-id scroll offsets are not supported; use the returned LambdaDB page-token offset",
      );
    }
    const payloadSelector = normalizePayloadSelector(withPayload ?? withPayloadSnake ?? true);
    const vectorSelector = normalizeVectorSelector(withVectors ?? withVectorsSnake ?? false);
    const fields = fieldsForSelectors(payloadSelector, vectorSelector);
    const convertedFilter = filterToLambdaDB(scrollFilter ?? scrollFilterSnake);
    const listBody: ListDocsBody = {
      size: limit,
      includeVectors: vectorSelector !== false,
    };
    if (offset !== undefined) listBody.pageToken = offset;
    if (Object.keys(convertedFilter).length > 0) listBody.filter = convertedFilter;
    if (fields !== undefined) listBody.fields = fields;
    const response = await this.client.collection(collectionName).docs.list(listBody);
    return [
      response.docs.map((doc) => docToRecord(doc, {
        withPayload: payloadSelector,
        withVectors: vectorSelector,
      })),
      response.nextPageToken,
    ];
  }

  async count(
    collectionName: string,
    options: {
      countFilter?: models.Filter | JsonObject | null;
      count_filter?: models.Filter | JsonObject | null;
      [key: string]: unknown;
    } = {},
  ): Promise<models.CountResult> {
    const { countFilter, count_filter: countFilterSnake, ...rest } = options;
    warnIgnored(rest);
    if (countFilter !== undefined || countFilterSnake !== undefined) {
      throw new UnsupportedQdrantFeatureError("Filtered count is not supported in v1");
    }
    const collection = await this.currentCollection(collectionName);
    return new models.CountResult({
      count: typeof collection["numDocs"] === "number" ? collection["numDocs"] : 0,
    });
  }

  private async currentCollection(collectionName: string): Promise<JsonObject> {
    const response = await this.client.collection(collectionName).get();
    if (!isObject(response.collection)) {
      throw new QdrantCompatError("LambdaDB collection response is missing collection metadata");
    }
    return response.collection;
  }

  private async waitForCollectionActive(
    collectionName: string,
    timeoutSeconds: unknown,
  ): Promise<void> {
    const timeout = typeof timeoutSeconds === "number" ? timeoutSeconds : 60;
    const deadline = Date.now() + timeout * 1000;
    let lastStatus = "unknown";
    while (true) {
      const collection = await this.currentCollection(collectionName);
      const status = collection["collectionStatus"];
      if (status === undefined || status === "ACTIVE") return;
      lastStatus = String(status);
      if (Date.now() >= deadline) {
        throw new QdrantCompatError(
          `Collection ${collectionName} did not become ACTIVE within ${timeout}s; last status=${lastStatus}`,
        );
      }
      await sleep(500);
    }
  }
}

export const QdrantClient = QdrantCompatClient;

function normalizeConstructorOptions(
  options: CompatConstructorOptions = {},
): LambdaDBClientOptions {
  if (options.path !== undefined || options.location === ":memory:") {
    throw new UnsupportedQdrantFeatureError(
      "Qdrant local mode is not supported by LambdaDB compatibility client",
    );
  }

  const known = new Set([
    "projectApiKey",
    "project_api_key",
    "apiKey",
    "api_key",
    "baseUrl",
    "base_url",
    "url",
    "projectName",
    "project_name",
    "timeout",
    "timeoutMs",
    "retryConfig",
    "httpClient",
    "serverURL",
    "projectHost",
    "path",
    "location",
    "host",
    "port",
    "https",
    "prefix",
  ]);
  warnIgnored(unknownEntries(options, known));

  let baseUrl = options.baseUrl ?? options.base_url ?? options.url;
  if (baseUrl === undefined && options.host !== undefined) {
    const scheme = options.https === false ? "http" : "https";
    baseUrl = `${scheme}://${options.host}`;
    if (options.port !== undefined) baseUrl = `${baseUrl}:${options.port}`;
    if (options.prefix !== undefined) {
      baseUrl = `${baseUrl.replace(/\/+$/, "")}/${options.prefix.replace(/^\/+/, "")}`;
    }
  }
  if (
    typeof baseUrl === "string" &&
    (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"))
  ) {
    warn(
      "The Qdrant compatibility client interprets url as LambdaDB baseUrl, not a Qdrant server URL.",
    );
  }

  const timeoutMs = options.timeoutMs ??
    (typeof options.timeout === "number" ? Math.trunc(options.timeout * 1000) : undefined);

  const normalized: LambdaDBClientOptions = {};
  const projectApiKey = options.projectApiKey ?? options.project_api_key ??
    options.apiKey ?? options.api_key;
  if (projectApiKey !== undefined) normalized.projectApiKey = projectApiKey;
  if (typeof baseUrl === "string") normalized.baseUrl = baseUrl;
  const projectName = options.projectName ?? options.project_name;
  if (projectName !== undefined) normalized.projectName = projectName;
  if (timeoutMs !== undefined) normalized.timeoutMs = timeoutMs;
  if (options.retryConfig !== undefined) normalized.retryConfig = options.retryConfig;
  if (options.httpClient !== undefined) normalized.httpClient = options.httpClient;
  if (options.serverURL !== undefined) normalized.serverURL = options.serverURL;
  if (options.projectHost !== undefined) normalized.projectHost = options.projectHost;
  return normalized;
}

function normalizeCollectionArgs(
  collectionNameOrInput: string | (CreateCollectionOptions & {
    collectionName?: string;
    collection_name?: string;
  }),
  options: CreateCollectionOptions,
): {
  collectionName: string;
  body: CreateCollectionOptions;
} {
  if (typeof collectionNameOrInput === "string") {
    return { collectionName: collectionNameOrInput, body: { ...options } };
  }
  const collectionName = collectionNameOrInput.collectionName ??
    collectionNameOrInput.collection_name;
  if (collectionName === undefined) {
    throw new QdrantCompatValidationError("collectionName is required");
  }
  return { collectionName, body: { ...collectionNameOrInput, ...options } };
}

function popPayloadSchema(body: CreateCollectionOptions): unknown {
  const keys = [
    "payloadSchema",
    "payload_schema",
    "payloadIndexes",
    "payload_indexes",
    "payloadIndexConfigs",
    "payload_index_configs",
  ] as const;
  const present = keys.filter((key) => body[key] !== undefined && body[key] !== null);
  if (present.length > 1) {
    throw new QdrantCompatValidationError(
      `Use only one payload schema option, got: ${present.join(", ")}`,
    );
  }
  const [firstKey] = present;
  return firstKey === undefined ? undefined : body[firstKey];
}

function rejectResultChanging(body: JsonObject, allowed: Set<string>): void {
  const ignored = Object.entries(body)
    .filter(([key, value]) =>
      value !== undefined &&
      value !== null &&
      !allowed.has(key) &&
      ![
        "collectionName",
        "collection_name",
        "vectorsConfig",
        "vectors_config",
        "vectors",
        "payloadSchema",
        "payload_schema",
        "payloadIndexes",
        "payload_indexes",
        "payloadIndexConfigs",
        "payload_index_configs",
      ].includes(key)
    )
    .map(([key]) => key);
  if (ignored.length > 0) {
    throw new UnsupportedQdrantFeatureError(
      `Unsupported Qdrant collection options: ${ignored.join(", ")}`,
    );
  }
}

function idsFromSelector(selector: unknown): models.PointId[] | undefined {
  if (selector === undefined || selector === null) return undefined;
  if (Array.isArray(selector)) return selector as models.PointId[];
  if (isObject(selector)) {
    const points = selector["points"];
    const ids = selector["ids"];
    if (Array.isArray(points)) return points as models.PointId[];
    if (Array.isArray(ids)) return ids as models.PointId[];
  }
  return undefined;
}

function filterFromSelector(selector: unknown): models.Filter | JsonObject | null | undefined {
  if (isObject(selector) && "filter" in selector) {
    return selector["filter"] as models.Filter | JsonObject | null | undefined;
  }
  return undefined;
}

function hasSameIndexConfigs(existing: IndexConfigs, expected: IndexConfigs): boolean {
  return Object.entries(expected).every(([fieldName, indexConfig]) =>
    JSON.stringify(existing[fieldName]) === JSON.stringify(indexConfig),
  );
}

function normalizeOptionalPayloadSelector(selector: unknown): PayloadSelector | undefined {
  if (selector === undefined) return undefined;
  return normalizePayloadSelector(selector);
}

function normalizePayloadSelector(selector: unknown): PayloadSelector {
  if (selector === true || selector === false) return selector;
  if (Array.isArray(selector) && selector.every((item) => typeof item === "string")) {
    return selector;
  }
  throw new QdrantCompatValidationError(
    "withPayload/with_payload must be a boolean or a string field list",
  );
}

function normalizeOptionalVectorSelector(selector: unknown): VectorSelector | undefined {
  if (selector === undefined) return undefined;
  return normalizeVectorSelector(selector);
}

function normalizeVectorSelector(selector: unknown): VectorSelector {
  if (selector === true || selector === false) return selector;
  if (Array.isArray(selector) && selector.every((item) => typeof item === "string")) {
    return selector;
  }
  throw new QdrantCompatValidationError(
    "withVectors/with_vector must be a boolean or a string vector-name list",
  );
}

function fieldsForSelectors(
  payloadSelector: PayloadSelector,
  vectorSelector: VectorSelector,
): { include: string[] } | undefined {
  if (!Array.isArray(payloadSelector)) return undefined;
  if (vectorSelector === true) return undefined;

  const include = new Set<string>([ORIGINAL_ID_FIELD, ...payloadSelector]);
  if (Array.isArray(vectorSelector)) {
    for (const name of vectorSelector) include.add(vectorFieldName(name));
  }
  return { include: Array.from(include) };
}

function isLambdaDBLike(value: unknown): value is LambdaDBLike {
  return isObject(value) &&
    typeof value["createCollection"] === "function" &&
    typeof value["collection"] === "function";
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof ResourceNotFoundError ||
    (isObject(error) && error["name"] === "ResourceNotFoundError");
}

function unknownEntries(
  options: CompatConstructorOptions,
  known: Set<string>,
): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(options)) {
    if (!known.has(key)) result[key] = value;
  }
  return result;
}

function warnIgnored(options: JsonObject): void {
  const keys = Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key]) => key)
    .sort();
  if (keys.length > 0) {
    warn(`Ignoring unsupported Qdrant options: ${keys.join(", ")}`);
  }
}

function warn(message: string): void {
  console.warn(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
