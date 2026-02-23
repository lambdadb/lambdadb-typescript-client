/**
 * Collection-scoped facade for LambdaDB API.
 * Use this client for a better DX: no need to pass collectionName on every call.
 *
 * @example
 * const client = new LambdaDBClient({ projectApiKey: "..." });
 * const collection = client.collection("my-collection");
 * await collection.get();
 * await collection.docs.list({ size: 20 });
 * await collection.docs.upsert({ docs: [{ id: "1", text: "hello" }] });
 */

import { LambdaDBCore } from "./core.js";
import type { SDKOptions } from "./lib/config.js";
import { collectionsCreate } from "./funcs/collectionsCreate.js";
import { collectionsDelete } from "./funcs/collectionsDelete.js";
import { collectionsGet } from "./funcs/collectionsGet.js";
import { collectionsList } from "./funcs/collectionsList.js";
import { collectionsQuery } from "./funcs/collectionsQuery.js";
import { collectionsUpdate } from "./funcs/collectionsUpdate.js";
import { collectionsDocsBulkUpsert } from "./funcs/collectionsDocsBulkUpsert.js";
import { collectionsDocsDelete } from "./funcs/collectionsDocsDelete.js";
import { collectionsDocsFetch } from "./funcs/collectionsDocsFetch.js";
import { collectionsDocsGetBulkUpsert } from "./funcs/collectionsDocsGetBulkUpsert.js";
import { collectionsDocsListDocs } from "./funcs/collectionsDocsListDocs.js";
import { collectionsDocsUpdate } from "./funcs/collectionsDocsUpdate.js";
import { collectionsDocsUpsert } from "./funcs/collectionsDocsUpsert.js";
import type { RequestOptions } from "./lib/sdks.js";
import { unwrapAsync, OK, ERR } from "./types/fp.js";
import type { Result } from "./types/fp.js";
import type * as operations from "./models/operations/index.js";
import type * as models from "./models/index.js";
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
  QueryCollectionInput,
  QueryCollectionResponse,
  QueryCollectionDoc,
  ListDocsInput,
  ListDocsResponse,
  UpsertDocsInput,
  UpdateDocsInput,
  DeleteDocsInput,
  FetchDocsInput,
  FetchDocsResponse,
  FetchDocsDoc,
  BulkUpsertInput,
  MessageResponse,
  ListCollectionsResponse,
  CreateCollectionResponse,
  GetCollectionResponse,
  UpdateCollectionResponse,
  GetBulkUpsertDocsResponse,
} from "./types/public.js";
import type {
  ListCollectionsError,
  CreateCollectionError,
  GetCollectionError,
  UpdateCollectionError,
  DeleteCollectionError,
  QueryCollectionError,
  ListDocsError,
  UpsertDocsError,
  UpdateDocsError,
  DeleteDocsError,
  FetchDocsError,
  GetBulkUpsertDocsError,
  BulkUpsertDocsError,
} from "./types/errors.js";

export type { RequestOptions };

// Re-export public API types (request-body–level inputs and method return types)
export type * from "./types/public.js";

/**
 * @deprecated Use types from the package root (e.g. CreateCollectionInput, QueryCollectionResponse, ListDocsInput). Will be removed in the next major version.
 */
export type { operations, models };

/**
 * Fetches documents from a presigned docsUrl. Response must be { docs: [...] }.
 */
async function fetchDocsFromUrl<T>(docsUrl: string): Promise<T[]> {
  const res = await fetch(docsUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch documents from URL: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
    );
  }
  const json = (await res.json()) as { docs?: T[] };
  return json.docs ?? [];
}

/** Default base URL for the LambdaDB API. */
export const DEFAULT_BASE_URL = "https://api.lambdadb.ai";
/** Default project name when not specified. */
export const DEFAULT_PROJECT_NAME = "playground";

/**
 * Options for LambdaDBClient. Supports baseUrl + projectName (recommended) or
 * legacy projectHost / serverURL. When neither serverURL nor projectHost is set,
 * the base URL is built as `${baseUrl}/projects/${projectName}`.
 */
export type LambdaDBClientOptions = SDKOptions & {
  /**
   * API base URL (e.g. https://api.lambdadb.ai). Default: "https://api.lambdadb.ai"
   */
  baseUrl?: string;
  /**
   * Project name (path segment under /projects/). Default: "playground"
   */
  projectName?: string;
};

function normalizeClientOptions(
  options: LambdaDBClientOptions = {},
): SDKOptions {
  const {
    baseUrl = DEFAULT_BASE_URL,
    projectName = DEFAULT_PROJECT_NAME,
    serverURL,
    projectHost,
    ...rest
  } = options;

  if (serverURL !== undefined && serverURL !== null) {
    return { ...rest, serverURL };
  }
  if (projectHost !== undefined && projectHost !== null) {
    return { ...rest, projectHost };
  }

  const base = baseUrl.replace(/\/+$/, "");
  const serverURLFromBase = `${base}/projects/${encodeURIComponent(projectName)}`;
  return { ...rest, serverURL: serverURLFromBase };
}

/**
 * Client with collection-scoped API. Prefer this over the legacy
 * `LambdaDB` when you want to avoid passing collectionName on every call.
 */
export class LambdaDBClient extends LambdaDBCore {
  constructor(options?: LambdaDBClientOptions) {
    super(normalizeClientOptions(options));
  }

  /**
   * Get a handle for a specific collection. All methods on the handle
   * use this collection name; you do not pass it again.
   */
  collection(collectionName: string): CollectionHandle {
    return new CollectionHandle(this, collectionName);
  }

  /**
   * List all collections in the project.
   */
  async listCollections(options?: RequestOptions) {
    return unwrapAsync(collectionsList(this, options));
  }

  /**
   * List all collections (Safe: returns Result instead of throwing).
   */
  async listCollectionsSafe(
    options?: RequestOptions,
  ): Promise<Result<ListCollectionsResponse, ListCollectionsError>> {
    return await collectionsList(this, options);
  }

  /**
   * Create a new collection.
   */
  async createCollection(
    request: CreateCollectionInput,
    options?: RequestOptions,
  ) {
    return unwrapAsync(collectionsCreate(this, request, options));
  }

  /**
   * Create a new collection (Safe: returns Result instead of throwing).
   */
  async createCollectionSafe(
    request: CreateCollectionInput,
    options?: RequestOptions,
  ): Promise<Result<CreateCollectionResponse, CreateCollectionError>> {
    return await collectionsCreate(this, request, options);
  }
}

/**
 * Handle for a single collection. All methods operate on this collection.
 */
export class CollectionHandle {
  constructor(
    private readonly client: LambdaDBCore,
    readonly collectionName: string,
  ) {}

  /**
   * Get metadata of this collection.
   */
  async get(options?: RequestOptions) {
    return unwrapAsync(
      collectionsGet(this.client, { collectionName: this.collectionName }, options),
    );
  }

  /**
   * Get metadata of this collection (Safe: returns Result instead of throwing).
   */
  async getSafe(
    options?: RequestOptions,
  ): Promise<Result<GetCollectionResponse, GetCollectionError>> {
    return await collectionsGet(this.client, { collectionName: this.collectionName }, options);
  }

  /**
   * Configure (update) this collection.
   */
  async update(
    requestBody: UpdateCollectionInput,
    options?: RequestOptions,
  ) {
    return unwrapAsync(
      collectionsUpdate(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody,
        },
        options,
      ),
    );
  }

  /**
   * Configure (update) this collection (Safe: returns Result instead of throwing).
   */
  async updateSafe(
    requestBody: UpdateCollectionInput,
    options?: RequestOptions,
  ): Promise<Result<UpdateCollectionResponse, UpdateCollectionError>> {
    return await collectionsUpdate(
      this.client,
      { collectionName: this.collectionName, requestBody },
      options,
    );
  }

  /**
   * Delete this collection.
   */
  async delete(options?: RequestOptions) {
    return unwrapAsync(
      collectionsDelete(
        this.client,
        { collectionName: this.collectionName },
        options,
      ),
    );
  }

  /**
   * Delete this collection (Safe: returns Result instead of throwing).
   */
  async deleteSafe(
    options?: RequestOptions,
  ): Promise<Result<MessageResponse, DeleteCollectionError>> {
    return await collectionsDelete(
      this.client,
      { collectionName: this.collectionName },
      options,
    );
  }

  /**
   * Search this collection with a query.
   * When the API returns docs via docsUrl (isDocsInline false), documents are
   * fetched from the presigned URL automatically so the response always has docs.
   */
  async query(
    requestBody: QueryCollectionInput,
    options?: RequestOptions,
  ): Promise<QueryCollectionResponse> {
    const result = await unwrapAsync(
      collectionsQuery(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody,
        },
        options,
      ),
    );
    if (!result.isDocsInline && result.docsUrl) {
      const docs = await fetchDocsFromUrl<QueryCollectionDoc>(
        result.docsUrl,
      );
      return { ...result, docs, isDocsInline: true };
    }
    return result;
  }

  /**
   * Search this collection with a query (Safe: returns Result instead of throwing).
   * When the API returns docs via docsUrl, documents are fetched from the presigned URL automatically.
   */
  async querySafe(
    requestBody: QueryCollectionInput,
    options?: RequestOptions,
  ): Promise<Result<QueryCollectionResponse, QueryCollectionError>> {
    const result = await collectionsQuery(
      this.client,
      { collectionName: this.collectionName, requestBody },
      options,
    );
    if (!result.ok) return result;
    if (!result.value.isDocsInline && result.value.docsUrl) {
      try {
        const docs = await fetchDocsFromUrl<QueryCollectionDoc>(result.value.docsUrl);
        return OK({ ...result.value, docs, isDocsInline: true });
      } catch (e) {
        return ERR(e as QueryCollectionError);
      }
    }
    return result;
  }

  readonly docs: CollectionDocs = new CollectionDocs(this.client, this.collectionName);
}

/**
 * Document operations scoped to a collection.
 */
class CollectionDocs {
  constructor(
    private readonly client: LambdaDBCore,
    private readonly collectionName: string,
  ) {}

  /**
   * List documents in the collection.
   */
  async list(
    params?: ListDocsInput,
    options?: RequestOptions,
  ) {
    return unwrapAsync(
      collectionsDocsListDocs(
        this.client,
        { collectionName: this.collectionName, ...params },
        options,
      ),
    );
  }

  /**
   * List documents in the collection (Safe: returns Result instead of throwing).
   */
  async listSafe(
    params?: ListDocsInput,
    options?: RequestOptions,
  ): Promise<Result<ListDocsResponse, ListDocsError>> {
    return await collectionsDocsListDocs(
      this.client,
      { collectionName: this.collectionName, ...params },
      options,
    );
  }

  /**
   * Upsert documents. Max payload 6MB.
   */
  async upsert(
    body: UpsertDocsInput,
    options?: RequestOptions,
  ): Promise<MessageResponse> {
    return unwrapAsync(
      collectionsDocsUpsert(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody: body,
        },
        options,
      ),
    );
  }

  /**
   * Upsert documents (Safe: returns Result instead of throwing). Max payload 6MB.
   */
  async upsertSafe(
    body: UpsertDocsInput,
    options?: RequestOptions,
  ): Promise<Result<MessageResponse, UpsertDocsError>> {
    return await collectionsDocsUpsert(
      this.client,
      { collectionName: this.collectionName, requestBody: body },
      options,
    );
  }

  /**
   * Update documents (each doc must have id). Max payload 6MB.
   */
  async update(
    body: UpdateDocsInput,
    options?: RequestOptions,
  ): Promise<MessageResponse> {
    return unwrapAsync(
      collectionsDocsUpdate(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody: body,
        },
        options,
      ),
    );
  }

  /**
   * Update documents (Safe: returns Result instead of throwing). Max payload 6MB.
   */
  async updateSafe(
    body: UpdateDocsInput,
    options?: RequestOptions,
  ): Promise<Result<MessageResponse, UpdateDocsError>> {
    return await collectionsDocsUpdate(
      this.client,
      { collectionName: this.collectionName, requestBody: body },
      options,
    );
  }

  /**
   * Delete documents by ids and/or filter.
   */
  async delete(
    body: DeleteDocsInput,
    options?: RequestOptions,
  ): Promise<MessageResponse> {
    return unwrapAsync(
      collectionsDocsDelete(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody: body,
        },
        options,
      ),
    );
  }

  /**
   * Delete documents by ids and/or filter (Safe: returns Result instead of throwing).
   */
  async deleteSafe(
    body: DeleteDocsInput,
    options?: RequestOptions,
  ): Promise<Result<MessageResponse, DeleteDocsError>> {
    return await collectionsDocsDelete(
      this.client,
      { collectionName: this.collectionName, requestBody: body },
      options,
    );
  }

  /**
   * Fetch documents by IDs (max 100).
   * When the API returns docs via docsUrl (isDocsInline false), documents are
   * fetched from the presigned URL automatically so the response always has docs.
   */
  async fetch(
    body: FetchDocsInput,
    options?: RequestOptions,
  ): Promise<FetchDocsResponse> {
    const result = await unwrapAsync(
      collectionsDocsFetch(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody: body,
        },
        options,
      ),
    );
    if (!result.isDocsInline && result.docsUrl) {
      const docs = await fetchDocsFromUrl<FetchDocsDoc>(
        result.docsUrl,
      );
      return { ...result, docs, isDocsInline: true };
    }
    return result;
  }

  /**
   * Fetch documents by IDs (Safe: returns Result instead of throwing).
   * When the API returns docs via docsUrl, documents are fetched from the presigned URL automatically.
   */
  async fetchSafe(
    body: FetchDocsInput,
    options?: RequestOptions,
  ): Promise<Result<FetchDocsResponse, FetchDocsError>> {
    const result = await collectionsDocsFetch(
      this.client,
      { collectionName: this.collectionName, requestBody: body },
      options,
    );
    if (!result.ok) return result;
    if (!result.value.isDocsInline && result.value.docsUrl) {
      try {
        const docs = await fetchDocsFromUrl<FetchDocsDoc>(result.value.docsUrl);
        return OK({ ...result.value, docs, isDocsInline: true });
      } catch (e) {
        return ERR(e as FetchDocsError);
      }
    }
    return result;
  }

  /**
   * Get presigned URL and metadata for bulk upload (up to 200MB).
   */
  async getBulkUpsert(options?: RequestOptions) {
    return unwrapAsync(
      collectionsDocsGetBulkUpsert(
        this.client,
        { collectionName: this.collectionName },
        options,
      ),
    );
  }

  /**
   * Get presigned URL and metadata for bulk upload (Safe: returns Result instead of throwing).
   */
  async getBulkUpsertSafe(
    options?: RequestOptions,
  ): Promise<Result<GetBulkUpsertDocsResponse, GetBulkUpsertDocsError>> {
    return await collectionsDocsGetBulkUpsert(
      this.client,
      { collectionName: this.collectionName },
      options,
    );
  }

  /**
   * Trigger bulk upsert with an object key from getBulkUpsert().
   */
  async bulkUpsert(
    body: BulkUpsertInput,
    options?: RequestOptions,
  ): Promise<MessageResponse> {
    return unwrapAsync(
      collectionsDocsBulkUpsert(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody: body,
        },
        options,
      ),
    );
  }

  /**
   * Trigger bulk upsert (Safe: returns Result instead of throwing).
   */
  async bulkUpsertSafe(
    body: BulkUpsertInput,
    options?: RequestOptions,
  ): Promise<Result<MessageResponse, BulkUpsertDocsError>> {
    return await collectionsDocsBulkUpsert(
      this.client,
      { collectionName: this.collectionName, requestBody: body },
      options,
    );
  }

  /**
   * Bulk upsert documents in one call (up to 200MB). Abstracts getBulkUpsert,
   * S3 upload via presigned URL, and bulkUpsert. Use this for better DX when
   * you have a document list; use getBulkUpsert + bulkUpsert for low-level control.
   */
  async bulkUpsertDocs(
    body: UpsertDocsInput,
    options?: RequestOptions,
  ): Promise<MessageResponse> {
    const { url, type, httpMethod, objectKey, sizeLimitBytes } = await this.getBulkUpsert(options);

    const payload = { docs: body.docs };
    const jsonString = JSON.stringify(payload);
    const sizeBytes = new TextEncoder().encode(jsonString).length;
    if (sizeBytes > sizeLimitBytes) {
      throw new Error(
        `Bulk upsert payload size (${sizeBytes} bytes) exceeds limit (${sizeLimitBytes} bytes)`,
      );
    }

    const putResponse = await fetch(url, {
      method: httpMethod,
      headers: { "Content-Type": type },
      body: jsonString,
    });

    if (!putResponse.ok) {
      const text = await putResponse.text();
      throw new Error(
        `Bulk upsert upload failed: ${putResponse.status} ${putResponse.statusText}${text ? ` - ${text}` : ""}`,
      );
    }

    return this.bulkUpsert({ objectKey }, options);
  }

  /**
   * Bulk upsert documents in one call (Safe: returns Result instead of throwing).
   * May return Error for local failures (payload size, upload). API errors use GetBulkUpsertDocsError or BulkUpsertDocsError.
   */
  async bulkUpsertDocsSafe(
    body: UpsertDocsInput,
    options?: RequestOptions,
  ): Promise<
    Result<
      MessageResponse,
      GetBulkUpsertDocsError | BulkUpsertDocsError | Error
    >
  > {
    const getResult = await this.getBulkUpsertSafe(options);
    if (!getResult.ok) return getResult;
    const { url, type, httpMethod, objectKey, sizeLimitBytes } = getResult.value;

    const payload = { docs: body.docs };
    const jsonString = JSON.stringify(payload);
    const sizeBytes = new TextEncoder().encode(jsonString).length;
    if (sizeBytes > sizeLimitBytes) {
      return ERR(
        new Error(
          `Bulk upsert payload size (${sizeBytes} bytes) exceeds limit (${sizeLimitBytes} bytes)`,
        ),
      );
    }

    const putResponse = await fetch(url, {
      method: httpMethod,
      headers: { "Content-Type": type },
      body: jsonString,
    });

    if (!putResponse.ok) {
      const text = await putResponse.text();
      return ERR(
        new Error(
          `Bulk upsert upload failed: ${putResponse.status} ${putResponse.statusText}${text ? ` - ${text}` : ""}`,
        ),
      );
    }

    return this.bulkUpsertSafe({ objectKey }, options);
  }
}
