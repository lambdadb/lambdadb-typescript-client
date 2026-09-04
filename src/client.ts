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
import {
  HTTPClient,
  isAbortError,
  isConnectionError,
  isTimeoutError,
} from "./lib/http.js";
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
import { collectionsDocsListDocsExtended } from "./funcs/collectionsDocsListDocsExtended.js";
import { collectionsDocsUpdate } from "./funcs/collectionsDocsUpdate.js";
import { collectionsDocsUpsert } from "./funcs/collectionsDocsUpsert.js";
import type { RequestOptions } from "./lib/sdks.js";
import {
  ConnectionError,
  RequestAbortedError,
  RequestTimeoutError,
  UnexpectedClientError,
} from "./models/errors/httpclienterrors.js";
import {
  CollectionAliases,
  CollectionBranches,
  CollectionTags,
} from "./versioning.js";
import { unwrapAsync, OK, ERR } from "./types/fp.js";
import type { Result } from "./types/fp.js";
import type * as operations from "./models/operations/index.js";
import type * as models from "./models/index.js";
import {
  listCollectionsResponseWithDates,
  createCollectionResponseWithDates,
  getCollectionResponseWithDates,
  updateCollectionResponseWithDates,
  type CreateCollectionInput,
  type UpdateCollectionInput,
  type QueryCollectionInput,
  type QueryCollectionResponse,
  type QueryCollectionDoc,
  type ListDocsInput,
  type ListDocsResponse,
  type ListDocsDoc,
  type ListCollectionsInput,
  type ListCollectionsResponseWithDates,
  type GetCollectionResponseWithDates,
  type CreateCollectionResponseWithDates,
  type UpdateCollectionResponseWithDates,
  type GetBulkUpsertInput,
  type UpsertDocsInput,
  type UpdateDocsInput,
  type DeleteDocsInput,
  type FetchDocsInput,
  type FetchDocsResponse,
  type FetchDocsDoc,
  type BulkUpsertInput,
  type MessageResponse,
  type GetBulkUpsertDocsResponse,
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
function transferSignal(options?: RequestOptions): AbortSignal | undefined {
  const signal = options?.signal ?? options?.fetchOptions?.signal;
  if (signal != null) return signal;
  if (options?.timeoutMs != null && options.timeoutMs > 0) {
    return AbortSignal.timeout(options.timeoutMs);
  }
  return undefined;
}

function withTransferSignal(
  init: RequestInit,
  options?: RequestOptions,
): RequestInit {
  const signal = transferSignal(options);
  return signal === undefined ? init : { ...init, signal };
}

function serializeBulkUpsertPayload(
  docs: UpsertDocsInput["docs"],
): { jsonString: string; sizeBytes: number } {
  try {
    const jsonString = JSON.stringify({ docs });
    if (jsonString === undefined) {
      throw new TypeError("JSON.stringify returned undefined");
    }
    return {
      jsonString,
      sizeBytes: new TextEncoder().encode(jsonString).length,
    };
  } catch (cause) {
    throw new UnexpectedClientError(
      "Failed to serialize bulk upsert payload",
      { cause },
    );
  }
}

function classifyTransferError(message: string, cause: unknown): Error {
  if (isAbortError(cause)) {
    return new RequestAbortedError("Request aborted by client", { cause });
  }
  if (isTimeoutError(cause)) {
    return new RequestTimeoutError("Request timed out", { cause });
  }
  if (isConnectionError(cause)) {
    return new ConnectionError("Unable to make request", { cause });
  }
  return new UnexpectedClientError(message, { cause });
}

async function fetchDocsFromUrl<T>(
  transferClient: HTTPClient,
  docsUrl: string,
  options?: RequestOptions,
): Promise<T[]> {
  let res: Response;
  try {
    res = await transferClient.request(
      new Request(
        docsUrl,
        withTransferSignal({ method: "GET" }, options),
      ),
    );
  } catch (cause) {
    throw classifyTransferError("Failed to fetch documents from URL", cause);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new UnexpectedClientError(
      `Failed to fetch documents from URL: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`,
    );
  }
  const text = await res.text();
  if (text.trim() === "") {
    return [];
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (cause) {
    throw new UnexpectedClientError(
      "Failed to parse documents from URL as JSON",
      { cause },
    );
  }

  if (payload == null) {
    return [];
  }
  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new UnexpectedClientError("Unexpected document payload shape from URL");
  }

  const { docs } = payload as { docs?: unknown };
  if (docs == null) {
    return [];
  }
  if (!Array.isArray(docs)) {
    throw new UnexpectedClientError("Unexpected docs payload shape from URL");
  }
  return docs as T[];
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
  /**
   * Separate unauthenticated transport for presigned uploads and downloads.
   * API authentication and API request headers are never copied to it.
   */
  transferClient?: HTTPClient;
};

function normalizeClientOptions(
  options: LambdaDBClientOptions = {},
): SDKOptions {
  const {
    baseUrl = DEFAULT_BASE_URL,
    projectName = DEFAULT_PROJECT_NAME,
    serverURL,
    projectHost,
    transferClient: _transferClient,
    ...rest
  } = options;
  void _transferClient;

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
  readonly #transferClient: HTTPClient;

  constructor(options: LambdaDBClientOptions = {}) {
    super(normalizeClientOptions(options));
    this.#transferClient = options.transferClient ?? new HTTPClient();
  }

  /**
   * Get a handle for a specific collection. All methods on the handle
   * use this collection name; you do not pass it again.
   */
  collection(collectionName: string): CollectionHandle {
    return new CollectionHandle(this, collectionName, this.#transferClient);
  }

  /**
   * List collections in the project (with optional pagination). Timestamp fields are returned as Date.
   */
  async listCollections(
    params?: ListCollectionsInput,
    options?: RequestOptions,
  ): Promise<ListCollectionsResponseWithDates> {
    const res = await unwrapAsync(collectionsList(this, params, options));
    return listCollectionsResponseWithDates(res);
  }

  /**
   * List collections (Safe: returns Result instead of throwing). Timestamp fields are Date.
   */
  async listCollectionsSafe(
    params?: ListCollectionsInput,
    options?: RequestOptions,
  ): Promise<Result<ListCollectionsResponseWithDates, ListCollectionsError>> {
    const result = await collectionsList(this, params, options);
    if (!result.ok) return result;
    return OK(listCollectionsResponseWithDates(result.value));
  }

  /**
   * Iterate over all pages of collections. Yields one page per API response.
   * Use this to process many collections without loading everything into memory.
   *
   * @example
   * for await (const page of client.listCollectionsPages({ size: 20 })) {
   *   console.log(page.collections.length, page.nextPageToken ?? "last page");
   * }
   */
  async *listCollectionsPages(
    params?: ListCollectionsInput,
    options?: RequestOptions,
  ): AsyncGenerator<ListCollectionsResponseWithDates> {
    let pageToken: string | undefined = params?.pageToken;
    const baseParams: ListCollectionsInput = { size: params?.size, pageToken };
    while (true) {
      const page = await this.listCollections(
        { ...baseParams, pageToken } as ListCollectionsInput,
        options,
      );
      yield page;
      pageToken = page.nextPageToken;
      if (pageToken == null || pageToken === "") break;
    }
  }

  /**
   * Fetch all collections across pages and return a single list. Uses listCollectionsPages internally.
   */
  async listAllCollections(
    params?: ListCollectionsInput,
    options?: RequestOptions,
  ): Promise<{ collections: ListCollectionsResponseWithDates["collections"] }> {
    const collections: ListCollectionsResponseWithDates["collections"] = [];
    for await (const page of this.listCollectionsPages(params, options)) {
      collections.push(...page.collections);
    }
    return { collections };
  }

  /**
   * Create a new collection.
   */
  async createCollection(
    request: CreateCollectionInput,
    options?: RequestOptions,
  ): Promise<CreateCollectionResponseWithDates> {
    return createCollectionResponseWithDates(
      await unwrapAsync(collectionsCreate(this, request, options)),
    );
  }

  /**
   * Create a new collection (Safe: returns Result instead of throwing).
   */
  async createCollectionSafe(
    request: CreateCollectionInput,
    options?: RequestOptions,
  ): Promise<Result<CreateCollectionResponseWithDates, CreateCollectionError>> {
    const result = await collectionsCreate(this, request, options);
    if (!result.ok) return result;
    return OK(createCollectionResponseWithDates(result.value));
  }
}

/**
 * Handle for a single collection. All methods operate on this collection.
 */
export class CollectionHandle {
  constructor(
    private readonly client: LambdaDBCore,
    readonly collectionName: string,
    private readonly transferClient: HTTPClient = new HTTPClient(),
  ) {}

  readonly branches = new CollectionBranches(this.client, this.collectionName);
  readonly tags = new CollectionTags(this.client, this.collectionName);
  readonly aliases = new CollectionAliases(this.client, this.collectionName);

  /**
   * Get metadata of this collection. Timestamp fields are returned as Date.
   */
  async get(options?: RequestOptions): Promise<GetCollectionResponseWithDates> {
    const res = await unwrapAsync(
      collectionsGet(this.client, { collectionName: this.collectionName }, options),
    );
    return getCollectionResponseWithDates(res);
  }

  /**
   * Get metadata of this collection (Safe: returns Result instead of throwing). Timestamp fields are Date.
   */
  async getSafe(
    options?: RequestOptions,
  ): Promise<Result<GetCollectionResponseWithDates, GetCollectionError>> {
    const result = await collectionsGet(
      this.client,
      { collectionName: this.collectionName },
      options,
    );
    if (!result.ok) return result;
    return OK(getCollectionResponseWithDates(result.value));
  }

  /**
   * Configure (update) this collection.
   */
  async update(
    requestBody: UpdateCollectionInput,
    options?: RequestOptions,
  ): Promise<UpdateCollectionResponseWithDates> {
    const response = await unwrapAsync(
      collectionsUpdate(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody,
        },
        options,
      ),
    );
    return updateCollectionResponseWithDates(response);
  }

  /**
   * Configure (update) this collection (Safe: returns Result instead of throwing).
   */
  async updateSafe(
    requestBody: UpdateCollectionInput,
    options?: RequestOptions,
  ): Promise<Result<UpdateCollectionResponseWithDates, UpdateCollectionError>> {
    const result = await collectionsUpdate(
      this.client,
      { collectionName: this.collectionName, requestBody },
      options,
    );
    if (!result.ok) return result;
    return OK(updateCollectionResponseWithDates(result.value));
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
        this.transferClient,
        result.docsUrl,
        options,
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
        const docs = await fetchDocsFromUrl<QueryCollectionDoc>(
          this.transferClient,
          result.value.docsUrl,
          options,
        );
        return OK({ ...result.value, docs, isDocsInline: true });
      } catch (e) {
        return ERR(e as QueryCollectionError);
      }
    }
    return result;
  }

  readonly docs: CollectionDocs = new CollectionDocs(
    this.client,
    this.collectionName,
    this.transferClient,
  );
}

/**
 * Document operations scoped to a collection.
 */
export class CollectionDocs {
  constructor(
    private readonly client: LambdaDBCore,
    private readonly collectionName: string,
    private readonly transferClient: HTTPClient,
  ) {}

  /**
   * List documents in the collection.
   * When the API returns docs via docsUrl (isDocsInline false), documents are
   * fetched from the presigned URL automatically so the response always has docs.
   */
  async list(
    params?: ListDocsInput,
    options?: RequestOptions,
  ) {
    const useExtendedList = params?.filter != null
      || params?.partitionFilter != null
      || params?.fields != null;
    const result = await unwrapAsync(
      useExtendedList
        ? collectionsDocsListDocsExtended(
          this.client,
          {
            collectionName: this.collectionName,
            requestBody: {
              size: params?.size,
              pageToken: params?.pageToken,
              filter: params?.filter,
              partitionFilter: params?.partitionFilter,
              fields: params?.fields,
              includeVectors: params?.includeVectors,
              ref: params?.ref,
            },
          },
          options,
        )
        : collectionsDocsListDocs(
          this.client,
          {
            collectionName: this.collectionName,
            size: params?.size,
            pageToken: params?.pageToken,
            includeVectors: params?.includeVectors,
            refKind: params?.ref?.kind,
            refName: params?.ref?.name,
          },
          options,
        ),
    );
    if (!result.isDocsInline && result.docsUrl) {
      const docs = await fetchDocsFromUrl<ListDocsDoc>(
        this.transferClient,
        result.docsUrl,
        options,
      );
      return { ...result, docs, isDocsInline: true };
    }
    return result;
  }

  /**
   * List documents in the collection (Safe: returns Result instead of throwing).
   * When the API returns docs via docsUrl, documents are fetched from the presigned URL automatically.
   */
  async listSafe(
    params?: ListDocsInput,
    options?: RequestOptions,
  ): Promise<Result<ListDocsResponse, ListDocsError>> {
    const useExtendedList = params?.filter != null
      || params?.partitionFilter != null
      || params?.fields != null;
    const result = useExtendedList
      ? await collectionsDocsListDocsExtended(
        this.client,
        {
          collectionName: this.collectionName,
          requestBody: {
            size: params?.size,
            pageToken: params?.pageToken,
            filter: params?.filter,
            partitionFilter: params?.partitionFilter,
            fields: params?.fields,
            includeVectors: params?.includeVectors,
            ref: params?.ref,
          },
        },
        options,
      )
      : await collectionsDocsListDocs(
        this.client,
        {
          collectionName: this.collectionName,
          size: params?.size,
          pageToken: params?.pageToken,
          includeVectors: params?.includeVectors,
          refKind: params?.ref?.kind,
          refName: params?.ref?.name,
        },
        options,
      );
    if (!result.ok) return result;
    if (!result.value.isDocsInline && result.value.docsUrl) {
      try {
        const docs = await fetchDocsFromUrl<ListDocsDoc>(
          this.transferClient,
          result.value.docsUrl,
          options,
        );
        return OK({ ...result.value, docs, isDocsInline: true });
      } catch (e) {
        return ERR(e as ListDocsError);
      }
    }
    return result;
  }

  /**
   * Iterate over all pages of documents. Yields one page per API response (with docs and nextPageToken).
   * Use this to process large result sets without loading everything into memory.
   *
   * Note: The API limits response size by payload, not by document count. The number of docs per page
   * may be less than the requested `size` and can vary from page to page.
   *
   * @example
   * for await (const page of collection.docs.listPages({ size: 50 })) {
   *   console.log(page.docs.length, page.nextPageToken ?? "last page");
   * }
   */
  async *listPages(
    params?: ListDocsInput,
    options?: RequestOptions,
  ): AsyncGenerator<ListDocsResponse> {
    let pageToken: string | undefined = params?.pageToken;
    const baseParams: ListDocsInput = {
      size: params?.size,
      pageToken,
      filter: params?.filter,
      partitionFilter: params?.partitionFilter,
      fields: params?.fields,
      includeVectors: params?.includeVectors,
      ref: params?.ref,
    };
    while (true) {
      const page = await this.list({ ...baseParams, pageToken }, options);
      yield page;
      pageToken = page.nextPageToken;
      if (pageToken == null || pageToken === "") break;
    }
  }

  /**
   * Fetch all documents across pages and return a single list. Uses listPages internally.
   * For large collections, prefer listPages() to avoid high memory use.
   *
   * Note: Page size is constrained by API payload limits, so the number of docs per page may vary.
   */
  async listAll(
    params?: ListDocsInput,
    options?: RequestOptions,
  ): Promise<{ docs: Array<Record<string, unknown>>; total: number }> {
    const docs: Array<Record<string, unknown>> = [];
    let total = 0;
    for await (const page of this.listPages(params, options)) {
      docs.push(...page.docs);
      total = page.total;
    }
    return { docs, total };
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
        this.transferClient,
        result.docsUrl,
        options,
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
        const docs = await fetchDocsFromUrl<FetchDocsDoc>(
          this.transferClient,
          result.value.docsUrl,
          options,
        );
        return OK({ ...result.value, docs, isDocsInline: true });
      } catch (e) {
        return ERR(e as FetchDocsError);
      }
    }
    return result;
  }

  /**
   * Get presigned URL and metadata for bulk upload (up to 200MB). Not supported for collections with managed embedding vector fields.
   */
  async getBulkUpsert(
    options?: RequestOptions,
  ): Promise<GetBulkUpsertDocsResponse>;
  async getBulkUpsert(
    input: GetBulkUpsertInput,
    options?: RequestOptions,
  ): Promise<GetBulkUpsertDocsResponse>;
  async getBulkUpsert(
    inputOrOptions?: GetBulkUpsertInput | RequestOptions,
    options?: RequestOptions,
  ): Promise<GetBulkUpsertDocsResponse> {
    const hasInput = options !== undefined
      || (inputOrOptions != null && "branch" in inputOrOptions);
    const input = hasInput ? inputOrOptions as GetBulkUpsertInput : {};
    const requestOptions = hasInput
      ? options
      : inputOrOptions as RequestOptions | undefined;
    return unwrapAsync(
      collectionsDocsGetBulkUpsert(
        this.client,
        { collectionName: this.collectionName, branch: input.branch },
        requestOptions,
      ),
    );
  }

  /**
   * Get presigned URL and metadata for bulk upload (Safe: returns Result instead of throwing). Not supported for collections with managed embedding vector fields.
   */
  async getBulkUpsertSafe(
    options?: RequestOptions,
  ): Promise<Result<GetBulkUpsertDocsResponse, GetBulkUpsertDocsError>>;
  async getBulkUpsertSafe(
    input: GetBulkUpsertInput,
    options?: RequestOptions,
  ): Promise<Result<GetBulkUpsertDocsResponse, GetBulkUpsertDocsError>>;
  async getBulkUpsertSafe(
    inputOrOptions?: GetBulkUpsertInput | RequestOptions,
    options?: RequestOptions,
  ): Promise<Result<GetBulkUpsertDocsResponse, GetBulkUpsertDocsError>> {
    const hasInput = options !== undefined
      || (inputOrOptions != null && "branch" in inputOrOptions);
    const input = hasInput ? inputOrOptions as GetBulkUpsertInput : {};
    const requestOptions = hasInput
      ? options
      : inputOrOptions as RequestOptions | undefined;
    return await collectionsDocsGetBulkUpsert(
      this.client,
      { collectionName: this.collectionName, branch: input.branch },
      requestOptions,
    );
  }

  /**
   * Trigger bulk upsert with an object key from getBulkUpsert(). Not supported for collections with managed embedding vector fields.
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
   * Trigger bulk upsert (Safe: returns Result instead of throwing). Not supported for collections with managed embedding vector fields.
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
   * Bulk upsert documents in one call (up to 200MB). Not supported for collections with managed embedding vector fields. Abstracts getBulkUpsert,
   * S3 upload via presigned URL, and bulkUpsert. Use this for better DX when
   * you have a document list; use getBulkUpsert + bulkUpsert for low-level control.
   */
  async bulkUpsertDocs(
    body: UpsertDocsInput,
    options?: RequestOptions,
  ): Promise<MessageResponse> {
    const { url, type, httpMethod, objectKey, sizeLimitBytes, headers } =
      await this.getBulkUpsert({ branch: body.branch }, options);

    const { jsonString, sizeBytes } = serializeBulkUpsertPayload(body.docs);
    if (sizeBytes > sizeLimitBytes) {
      throw new Error(
        `Bulk upsert payload size (${sizeBytes} bytes) exceeds limit (${sizeLimitBytes} bytes)`,
      );
    }

    const uploadHeaders = new Headers(headers);
    uploadHeaders.set("Content-Type", type);
    let putResponse: Response;
    try {
      putResponse = await this.transferClient.request(
        new Request(
          url,
          withTransferSignal({
            method: httpMethod,
            headers: uploadHeaders,
            body: jsonString,
          }, options),
        ),
      );
    } catch (cause) {
      throw classifyTransferError("Bulk upsert upload failed", cause);
    }

    if (!putResponse.ok) {
      const text = await putResponse.text();
      throw new Error(
        `Bulk upsert upload failed: ${putResponse.status} ${putResponse.statusText}${text ? ` - ${text}` : ""}`,
      );
    }

    return this.bulkUpsert({ objectKey, type, branch: body.branch }, options);
  }

  /**
   * Bulk upsert documents in one call (Safe: returns Result instead of throwing). Not supported for collections with managed embedding vector fields.
   * May return Error for local failures (serialization, payload size, upload). API errors use GetBulkUpsertDocsError or BulkUpsertDocsError.
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
    const getResult = await this.getBulkUpsertSafe(
      { branch: body.branch },
      options,
    );
    if (!getResult.ok) return getResult;
    const { url, type, httpMethod, objectKey, sizeLimitBytes, headers } =
      getResult.value;

    let jsonString: string;
    let sizeBytes: number;
    try {
      ({ jsonString, sizeBytes } = serializeBulkUpsertPayload(body.docs));
    } catch (cause) {
      return ERR(
        cause instanceof Error
          ? cause
          : new UnexpectedClientError(
            "Failed to serialize bulk upsert payload",
            { cause },
          ),
      );
    }
    if (sizeBytes > sizeLimitBytes) {
      return ERR(
        new Error(
          `Bulk upsert payload size (${sizeBytes} bytes) exceeds limit (${sizeLimitBytes} bytes)`,
        ),
      );
    }

    let putResponse: Response;
    try {
      const uploadHeaders = new Headers(headers);
      uploadHeaders.set("Content-Type", type);
      putResponse = await this.transferClient.request(
        new Request(
          url,
          withTransferSignal({
            method: httpMethod,
            headers: uploadHeaders,
            body: jsonString,
          }, options),
        ),
      );
    } catch (cause) {
      return ERR(classifyTransferError("Bulk upsert upload failed", cause));
    }

    if (!putResponse.ok) {
      const text = await putResponse.text();
      return ERR(
        new Error(
          `Bulk upsert upload failed: ${putResponse.status} ${putResponse.statusText}${text ? ` - ${text}` : ""}`,
        ),
      );
    }

    return this.bulkUpsertSafe({ objectKey, type, branch: body.branch }, options);
  }
}
