import * as z from "zod/v3";

import type { LambdaDBCore } from "./core.js";
import { encodeFormQuery } from "./lib/encodings.js";
import * as M from "./lib/matchers.js";
import { compactMap } from "./lib/primitives.js";
import { nullToUndefined, safeParse } from "./lib/schemas.js";
import type { RequestOptions } from "./lib/sdks.js";
import { extractSecurity, resolveGlobalSecurity } from "./lib/security.js";
import * as errors from "./models/errors/index.js";
import type { LambdaDBError } from "./models/errors/lambdadberror.js";
import type { ResponseValidationError } from "./models/errors/responsevalidationerror.js";
import type { SDKValidationError } from "./models/errors/sdkvalidationerror.js";
import {
  AliasDetails$inboundSchema,
  AliasTarget$schema,
  BranchDetails$inboundSchema,
  TagDetails$inboundSchema,
  RefSource$schema,
  type AliasRef,
  type BranchRef,
  type BranchSource,
  type TagRef,
  type TagSource,
} from "./models/versioning.js";
import { IndexConfigsUnion$outboundSchema } from "./models/indexconfigsunion.js";
import type {
  ConnectionError,
  InvalidRequestError,
  RequestAbortedError,
  RequestTimeoutError,
  UnexpectedClientError,
} from "./models/errors/httpclienterrors.js";
import {
  aliasDetailsWithDate,
  branchDetailsWithDates,
  tagDetailsWithDates,
  type AliasResponse,
  type CreateAliasInput,
  type CreateBranchInput,
  type CreateBranchResponse,
  type CreateTagInput,
  type CreateTagResponse,
  type GetBranchResponse,
  type GetTagResponse,
  type ListAliasesPageResponse,
  type ListAliasesResponse,
  type ListBranchesPageResponse,
  type ListBranchesResponse,
  type ListRefsInput,
  type ListTagsPageResponse,
  type ListTagsResponse,
  type MessageResponse,
  type RetargetAliasInput,
  type UpdateBranchInput,
  type UpdateBranchResponse,
} from "./types/public.js";
import type { Result } from "./types/fp.js";

/**
 * Exact public contract revision implemented by this SDK: the lambdadb/docs
 * commit of `reference/api/openapi.json` (SHA-256
 * ec499bb6ad4fd7359c1854359e9ecfd4cd8609420f440f7dcbf75566ccda8f32).
 */
export const DATA_VERSIONING_CONTRACT_REVISION =
  "7be299af9cac4195b75feb6e38b5cd7f8989f5a0" as const;

const refNamePattern = /^[a-zA-Z0-9_-]{3,52}$/;
const refNameSchema = z.string().regex(refNamePattern);

function checkedRefName(name: string): string {
  if (!refNamePattern.test(name)) {
    throw new TypeError(
      "Ref names must contain 3 to 52 letters, numbers, underscores, or hyphens",
    );
  }
  return name;
}

/** Creates a validated Branch read ref. */
export function branchRef(name: string): BranchRef {
  return { kind: "branch", name: checkedRefName(name) };
}

/** Creates a validated Tag read ref. */
export function tagRef(name: string): TagRef {
  return { kind: "tag", name: checkedRefName(name) };
}

/** Creates a validated Alias read ref. */
export function aliasRef(name: string): AliasRef {
  return { kind: "alias", name: checkedRefName(name) };
}

/**
 * Creates a validated Branch source. An optional `asOf` selects the latest
 * retained committed snapshot at or before that Unix-millisecond cutoff,
 * excluding inherited and pending writes.
 */
export function branchSource(
  name: string,
  asOf?: Date | number,
): BranchSource {
  const source: BranchSource = { kind: "branch", name: checkedRefName(name) };
  if (asOf !== undefined) {
    const milliseconds = asOf instanceof Date ? asOf.getTime() : asOf;
    if (!Number.isInteger(milliseconds)) {
      throw new TypeError("Branch source asOf must be a valid Date or integer Unix milliseconds");
    }
    source.asOf = milliseconds;
  }
  return source;
}

/**
 * Creates a validated Tag source for a new Branch or Tag. `asOf` is
 * intentionally unavailable.
 */
export function tagSource(name: string): TagSource {
  return tagRef(name);
}

/** Creates a validated Branch Alias target. */
export function branchTarget(name: string): BranchRef {
  return branchRef(name);
}

/** Creates a validated Tag Alias target. */
export function tagTarget(name: string): TagRef {
  return tagRef(name);
}

export type VersioningError =
  | errors.BadRequestError
  | errors.UnauthenticatedError
  | errors.ResourceNotFoundError
  | errors.ResourceAlreadyExistsError
  | errors.CatalogConflictError
  | errors.PayloadTooLargeError
  | errors.TooManyRequestsError
  | errors.InternalServerError
  | errors.BadGatewayError
  | errors.ServiceUnavailableError
  | errors.GatewayTimeoutError
  | LambdaDBError
  | ResponseValidationError
  | ConnectionError
  | RequestAbortedError
  | RequestTimeoutError
  | InvalidRequestError
  | UnexpectedClientError
  | SDKValidationError;

type VersioningRequest<TInput, TOutput> = {
  body?: TInput | undefined;
  bodySchema?: z.ZodType<unknown, z.ZodTypeDef, TInput> | undefined;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: string | undefined;
  responseSchema: z.ZodType<TOutput, z.ZodTypeDef, unknown>;
  successStatus: 200 | 201;
  conflict?: "already-exists" | "catalog" | undefined;
};

async function requestVersioning<TInput, TOutput>(
  client: LambdaDBCore,
  request: VersioningRequest<TInput, TOutput>,
  options?: RequestOptions,
): Promise<Result<TOutput, VersioningError>> {
  let body: string | null = null;
  if (request.bodySchema !== undefined) {
    const parsed = safeParse(
      request.body,
      (value) => request.bodySchema?.parse(value),
      "Input validation failed",
    );
    if (!parsed.ok) return parsed;
    body = JSON.stringify(parsed.value);
  }

  const headers = new Headers(compactMap({
    Accept: "application/json",
    "Content-Type": body == null ? undefined : "application/json",
  }));
  const secConfig = await extractSecurity(client._options.projectApiKey);
  const securityInput = secConfig == null ? {} : { projectApiKey: secConfig };
  const requestSecurity = resolveGlobalSecurity(securityInput);
  const retryConfig = options?.retries
    || client._options.retryConfig
    || {
      strategy: "backoff" as const,
      backoff: {
        initialInterval: 500,
        maxInterval: 60000,
        exponent: 1.5,
        maxElapsedTime: 3600000,
      },
      retryConnectionErrors: true,
    };
  const retryCodes = options?.retryCodes || ["429", "5XX"];
  const context = {
    options: client._options,
    baseURL: options?.serverURL ?? client._baseURL ?? "",
    operationID: `${request.method} ${request.path}`,
    oAuth2Scopes: null,
    resolvedSecurity: requestSecurity,
    securitySource: client._options.projectApiKey,
    retryConfig,
    retryCodes,
  };

  const requestResult = client._createRequest(context, {
    security: requestSecurity,
    method: request.method,
    baseURL: options?.serverURL,
    path: request.path,
    headers,
    query: request.query ?? "",
    body,
    userAgent: client._options.userAgent,
    timeoutMs: options?.timeoutMs || client._options.timeoutMs || -1,
  }, options);
  if (!requestResult.ok) return requestResult;

  const httpRequest = requestResult.value;
  const responseResult = await client._do(httpRequest, {
    context,
    errorCodes: ["400", "401", "404", "409", "429", "4XX", "500", "5XX"],
    retryConfig,
    retryCodes,
  });
  if (!responseResult.ok) return responseResult;

  const response = responseResult.value;
  const conflictMatchers = request.conflict === "already-exists"
    ? [M.jsonErr(409, errors.ResourceAlreadyExistsError$inboundSchema)]
    : request.conflict === "catalog"
    ? [M.jsonErr(409, errors.CatalogConflictError$inboundSchema)]
    : [];
  const [result] = await M.match<TOutput, VersioningError>(
    M.json(request.successStatus, request.responseSchema),
    M.jsonErr(400, errors.BadRequestError$inboundSchema),
    M.jsonErr(401, errors.UnauthenticatedError$inboundSchema),
    M.jsonErr(404, errors.ResourceNotFoundError$inboundSchema),
    ...conflictMatchers,
    M.jsonErr(429, errors.TooManyRequestsError$inboundSchema),
    M.jsonErr(500, errors.InternalServerError$inboundSchema),
    ...M.gatewayErrorMatchers(),
    M.fail("4XX"),
    M.fail("5XX"),
  )(response, httpRequest, {
    extraFields: { HttpMeta: { Response: response, Request: httpRequest } },
  });
  return result;
}

function pathFor(collectionName: string, suffix: string): string {
  return `/collections/${encodeURIComponent(collectionName)}${suffix}`;
}

const listRefsSchema: z.ZodType<ListRefsInput> = z.object({
  size: z.number().int().min(1).max(100).optional(),
  pageToken: z.string().optional(),
}).strict();
const nextPageTokenSchema = nullToUndefined(z.string().optional());

/**
 * Validates listing parameters and encodes only the supplied ones. The server
 * rejects unknown query parameters and an empty pageToken, so an empty token
 * is omitted like an unset one.
 */
function listRefsQuery(params: ListRefsInput | undefined): Result<string, SDKValidationError> {
  const parsed = safeParse(
    params ?? {},
    (value) => listRefsSchema.parse(value),
    "Input validation failed",
  );
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    value: encodeFormQuery({
      pageToken: parsed.value.pageToken === "" ? undefined : parsed.value.pageToken,
      size: parsed.value.size,
    }),
  };
}

/** Copies nextPageToken only when the server returned one. */
function withNextPageToken<T extends object>(
  value: T,
  nextPageToken: string | undefined,
): T & { nextPageToken?: string | undefined } {
  return nextPageToken === undefined ? value : { ...value, nextPageToken };
}

async function* refPages<TPage extends { nextPageToken?: string | undefined }>(
  params: ListRefsInput | undefined,
  list: (params: ListRefsInput) => Promise<TPage>,
): AsyncGenerator<TPage> {
  let pageToken = params?.pageToken;
  while (true) {
    const page = await list({ ...params, pageToken });
    yield page;
    pageToken = page.nextPageToken;
    if (pageToken == null || pageToken === "") break;
  }
}

/** Collects every page from the first one; the first failure ends the listing. */
async function allRefPages<TPage extends { nextPageToken?: string | undefined }, TError>(
  listPage: (params: ListRefsInput) => Promise<Result<TPage, TError>>,
): Promise<Result<TPage[], TError>> {
  const pages: TPage[] = [];
  let pageToken: string | undefined;
  while (true) {
    const page = await listPage({ pageToken });
    if (!page.ok) return page;
    pages.push(page.value);
    pageToken = page.value.nextPageToken;
    if (pageToken == null || pageToken === "") break;
  }
  return { ok: true, value: pages };
}

function parseRefName(name: string): Result<string, SDKValidationError> {
  return safeParse(
    name,
    (value) => refNameSchema.parse(value),
    "Input validation failed",
  );
}

const createBranchSchema: z.ZodType<CreateBranchInput> = z.object({
  branchName: z.string().regex(refNamePattern),
  source: RefSource$schema.optional(),
}).strict();
const updateBranchSchema = z.object({
  indexConfigs: z.record(IndexConfigsUnion$outboundSchema).refine(
    (value) => Object.keys(value).length > 0,
    { message: "Branch indexConfigs must contain at least one field" },
  ),
}).strict();
const branchResponseSchema = z.object({ branch: BranchDetails$inboundSchema });
const listBranchesResponseSchema = z.object({
  branches: z.array(BranchDetails$inboundSchema),
  nextPageToken: nextPageTokenSchema,
});

const createTagSchema: z.ZodType<CreateTagInput> = z.object({
  tagName: z.string().regex(refNamePattern),
  source: RefSource$schema.optional(),
}).strict();
const tagResponseSchema = z.object({ tag: TagDetails$inboundSchema });
const listTagsResponseSchema = z.object({
  tags: z.array(TagDetails$inboundSchema),
  nextPageToken: nextPageTokenSchema,
});

const createAliasSchema: z.ZodType<CreateAliasInput> = z.object({
  aliasName: z.string().regex(refNamePattern),
  target: AliasTarget$schema,
}).strict();
const retargetAliasSchema: z.ZodType<RetargetAliasInput> = z.object({
  target: AliasTarget$schema,
}).strict();
const aliasResponseSchema = z.object({ alias: AliasDetails$inboundSchema });
const listAliasesResponseSchema = z.object({
  aliases: z.array(AliasDetails$inboundSchema),
  nextPageToken: nextPageTokenSchema,
});
const messageResponseSchema = z.object({ message: z.string() });

export class CollectionBranches {
  constructor(
    private readonly client: LambdaDBCore,
    private readonly collectionName: string,
  ) {}

  async create(input: CreateBranchInput, options?: RequestOptions): Promise<CreateBranchResponse> {
    const result = await this.createSafe(input, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async createSafe(
    input: CreateBranchInput,
    options?: RequestOptions,
  ): Promise<Result<CreateBranchResponse, VersioningError>> {
    const result = await requestVersioning(this.client, {
      body: input,
      bodySchema: createBranchSchema,
      method: "POST",
      path: pathFor(this.collectionName, "/branches"),
      responseSchema: branchResponseSchema,
      successStatus: 201,
      conflict: "already-exists",
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { branch: branchDetailsWithDates(result.value.branch) } };
  }

  /**
   * Lists every Branch in name order. Follows `nextPageToken` with the server's
   * default page size, making one request per page.
   */
  async list(options?: RequestOptions): Promise<ListBranchesResponse> {
    const result = await this.listSafe(options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  /** Like `list`; a failure on any page returns that error and no partial list. */
  async listSafe(options?: RequestOptions): Promise<Result<ListBranchesResponse, VersioningError>> {
    const pages = await allRefPages((params) => this.listPageSafe(params, options));
    if (!pages.ok) return pages;
    return { ok: true, value: { branches: pages.value.flatMap((page) => page.branches) } };
  }

  /**
   * Lists one page of Branches in name order. The server returns 10 entries
   * unless `size` is set; `nextPageToken` is present when more follow.
   */
  async listPage(params?: ListRefsInput, options?: RequestOptions): Promise<ListBranchesPageResponse> {
    const result = await this.listPageSafe(params, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async listPageSafe(
    params?: ListRefsInput,
    options?: RequestOptions,
  ): Promise<Result<ListBranchesPageResponse, VersioningError>> {
    const query = listRefsQuery(params);
    if (!query.ok) return query;
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, "/branches"),
      query: query.value,
      responseSchema: listBranchesResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return {
      ok: true,
      value: withNextPageToken(
        { branches: result.value.branches.map(branchDetailsWithDates) },
        result.value.nextPageToken,
      ),
    };
  }

  /** Iterates over the pages of Branches, one page per API response. */
  listPages(params?: ListRefsInput, options?: RequestOptions): AsyncGenerator<ListBranchesPageResponse> {
    return refPages(params, (page) => this.listPage(page, options));
  }

  /** Gets a Branch. A name that is not a Branch fails with ResourceNotFoundError. */
  async get(branchName: string, options?: RequestOptions): Promise<GetBranchResponse> {
    const result = await this.getSafe(branchName, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async getSafe(
    branchName: string,
    options?: RequestOptions,
  ): Promise<Result<GetBranchResponse, VersioningError>> {
    const parsedName = parseRefName(branchName);
    if (!parsedName.ok) return parsedName;
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, `/branches/${encodeURIComponent(parsedName.value)}`),
      responseSchema: branchResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { branch: branchDetailsWithDates(result.value.branch) } };
  }

  /**
   * Updates the index schema of one Branch; other Branches are unchanged, and
   * updating main also updates the Collection's indexConfigs. Send the Branch's
   * complete existing schema plus any new fields.
   */
  async update(
    branchName: string,
    input: UpdateBranchInput,
    options?: RequestOptions,
  ): Promise<UpdateBranchResponse> {
    const result = await this.updateSafe(branchName, input, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async updateSafe(
    branchName: string,
    input: UpdateBranchInput,
    options?: RequestOptions,
  ): Promise<Result<UpdateBranchResponse, VersioningError>> {
    const parsedName = parseRefName(branchName);
    if (!parsedName.ok) return parsedName;
    const result = await requestVersioning(this.client, {
      body: input,
      bodySchema: updateBranchSchema,
      method: "PATCH",
      path: pathFor(this.collectionName, `/branches/${encodeURIComponent(parsedName.value)}`),
      responseSchema: branchResponseSchema,
      successStatus: 200,
      conflict: "catalog",
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { branch: branchDetailsWithDates(result.value.branch) } };
  }

  async delete(branchName: string, options?: RequestOptions): Promise<MessageResponse> {
    const result = await this.deleteSafe(branchName, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async deleteSafe(
    branchName: string,
    options?: RequestOptions,
  ): Promise<Result<MessageResponse, VersioningError>> {
    const parsedName = safeParse(
      branchName,
      (value) => refNameSchema.parse(value),
      "Input validation failed",
    );
    if (!parsedName.ok) return parsedName;
    return requestVersioning(this.client, {
      method: "DELETE",
      path: pathFor(this.collectionName, `/branches/${encodeURIComponent(parsedName.value)}`),
      responseSchema: messageResponseSchema,
      successStatus: 200,
      conflict: "catalog",
    }, options);
  }
}

export class CollectionTags {
  constructor(
    private readonly client: LambdaDBCore,
    private readonly collectionName: string,
  ) {}

  async create(input: CreateTagInput, options?: RequestOptions): Promise<CreateTagResponse> {
    const result = await this.createSafe(input, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async createSafe(
    input: CreateTagInput,
    options?: RequestOptions,
  ): Promise<Result<CreateTagResponse, VersioningError>> {
    const result = await requestVersioning(this.client, {
      body: input,
      bodySchema: createTagSchema,
      method: "POST",
      path: pathFor(this.collectionName, "/tags"),
      responseSchema: tagResponseSchema,
      successStatus: 201,
      conflict: "already-exists",
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { tag: tagDetailsWithDates(result.value.tag) } };
  }

  /**
   * Lists every Tag in name order. Follows `nextPageToken` with the server's
   * default page size, making one request per page.
   */
  async list(options?: RequestOptions): Promise<ListTagsResponse> {
    const result = await this.listSafe(options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  /** Like `list`; a failure on any page returns that error and no partial list. */
  async listSafe(options?: RequestOptions): Promise<Result<ListTagsResponse, VersioningError>> {
    const pages = await allRefPages((params) => this.listPageSafe(params, options));
    if (!pages.ok) return pages;
    return { ok: true, value: { tags: pages.value.flatMap((page) => page.tags) } };
  }

  /**
   * Lists one page of Tags in name order. The server returns 10 entries
   * unless `size` is set; `nextPageToken` is present when more follow.
   */
  async listPage(params?: ListRefsInput, options?: RequestOptions): Promise<ListTagsPageResponse> {
    const result = await this.listPageSafe(params, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async listPageSafe(
    params?: ListRefsInput,
    options?: RequestOptions,
  ): Promise<Result<ListTagsPageResponse, VersioningError>> {
    const query = listRefsQuery(params);
    if (!query.ok) return query;
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, "/tags"),
      query: query.value,
      responseSchema: listTagsResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return {
      ok: true,
      value: withNextPageToken(
        { tags: result.value.tags.map(tagDetailsWithDates) },
        result.value.nextPageToken,
      ),
    };
  }

  /** Iterates over the pages of Tags, one page per API response. */
  listPages(params?: ListRefsInput, options?: RequestOptions): AsyncGenerator<ListTagsPageResponse> {
    return refPages(params, (page) => this.listPage(page, options));
  }

  /** Gets a Tag. A name that is not a Tag fails with ResourceNotFoundError. */
  async get(tagName: string, options?: RequestOptions): Promise<GetTagResponse> {
    const result = await this.getSafe(tagName, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async getSafe(
    tagName: string,
    options?: RequestOptions,
  ): Promise<Result<GetTagResponse, VersioningError>> {
    const parsedName = parseRefName(tagName);
    if (!parsedName.ok) return parsedName;
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, `/tags/${encodeURIComponent(parsedName.value)}`),
      responseSchema: tagResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { tag: tagDetailsWithDates(result.value.tag) } };
  }

  async delete(tagName: string, options?: RequestOptions): Promise<MessageResponse> {
    const result = await this.deleteSafe(tagName, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async deleteSafe(
    tagName: string,
    options?: RequestOptions,
  ): Promise<Result<MessageResponse, VersioningError>> {
    const parsedName = safeParse(
      tagName,
      (value) => refNameSchema.parse(value),
      "Input validation failed",
    );
    if (!parsedName.ok) return parsedName;
    return requestVersioning(this.client, {
      method: "DELETE",
      path: pathFor(this.collectionName, `/tags/${encodeURIComponent(parsedName.value)}`),
      responseSchema: messageResponseSchema,
      successStatus: 200,
      conflict: "catalog",
    }, options);
  }
}

export class CollectionAliases {
  constructor(
    private readonly client: LambdaDBCore,
    private readonly collectionName: string,
  ) {}

  async create(input: CreateAliasInput, options?: RequestOptions): Promise<AliasResponse> {
    const result = await this.createSafe(input, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async createSafe(
    input: CreateAliasInput,
    options?: RequestOptions,
  ): Promise<Result<AliasResponse, VersioningError>> {
    const result = await requestVersioning(this.client, {
      body: input,
      bodySchema: createAliasSchema,
      method: "POST",
      path: pathFor(this.collectionName, "/aliases"),
      responseSchema: aliasResponseSchema,
      successStatus: 201,
      conflict: "already-exists",
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { alias: aliasDetailsWithDate(result.value.alias) } };
  }

  /**
   * Lists every Alias in name order. Follows `nextPageToken` with the server's
   * default page size, making one request per page.
   */
  async list(options?: RequestOptions): Promise<ListAliasesResponse> {
    const result = await this.listSafe(options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  /** Like `list`; a failure on any page returns that error and no partial list. */
  async listSafe(options?: RequestOptions): Promise<Result<ListAliasesResponse, VersioningError>> {
    const pages = await allRefPages((params) => this.listPageSafe(params, options));
    if (!pages.ok) return pages;
    return { ok: true, value: { aliases: pages.value.flatMap((page) => page.aliases) } };
  }

  /**
   * Lists one page of Aliases in name order. The server returns 10 entries
   * unless `size` is set; `nextPageToken` is present when more follow.
   */
  async listPage(params?: ListRefsInput, options?: RequestOptions): Promise<ListAliasesPageResponse> {
    const result = await this.listPageSafe(params, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async listPageSafe(
    params?: ListRefsInput,
    options?: RequestOptions,
  ): Promise<Result<ListAliasesPageResponse, VersioningError>> {
    const query = listRefsQuery(params);
    if (!query.ok) return query;
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, "/aliases"),
      query: query.value,
      responseSchema: listAliasesResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return {
      ok: true,
      value: withNextPageToken(
        { aliases: result.value.aliases.map(aliasDetailsWithDate) },
        result.value.nextPageToken,
      ),
    };
  }

  /** Iterates over the pages of Aliases, one page per API response. */
  listPages(params?: ListRefsInput, options?: RequestOptions): AsyncGenerator<ListAliasesPageResponse> {
    return refPages(params, (page) => this.listPage(page, options));
  }

  /**
   * Gets an Alias with the index schema it currently serves. A dangling Alias
   * still succeeds with `dangling: true` and null `indexConfigs`; a name that is
   * not an Alias fails with ResourceNotFoundError.
   */
  async get(aliasName: string, options?: RequestOptions): Promise<AliasResponse> {
    const result = await this.getSafe(aliasName, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async getSafe(
    aliasName: string,
    options?: RequestOptions,
  ): Promise<Result<AliasResponse, VersioningError>> {
    const parsedName = parseRefName(aliasName);
    if (!parsedName.ok) return parsedName;
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, `/aliases/${encodeURIComponent(parsedName.value)}`),
      responseSchema: aliasResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { alias: aliasDetailsWithDate(result.value.alias) } };
  }

  async retarget(
    aliasName: string,
    input: RetargetAliasInput,
    options?: RequestOptions,
  ): Promise<AliasResponse> {
    const result = await this.retargetSafe(aliasName, input, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async retargetSafe(
    aliasName: string,
    input: RetargetAliasInput,
    options?: RequestOptions,
  ): Promise<Result<AliasResponse, VersioningError>> {
    const parsedName = safeParse(
      aliasName,
      (value) => refNameSchema.parse(value),
      "Input validation failed",
    );
    if (!parsedName.ok) return parsedName;
    const result = await requestVersioning(this.client, {
      body: input,
      bodySchema: retargetAliasSchema,
      method: "PATCH",
      path: pathFor(this.collectionName, `/aliases/${encodeURIComponent(parsedName.value)}`),
      responseSchema: aliasResponseSchema,
      successStatus: 200,
      conflict: "catalog",
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { alias: aliasDetailsWithDate(result.value.alias) } };
  }

  async delete(aliasName: string, options?: RequestOptions): Promise<MessageResponse> {
    const result = await this.deleteSafe(aliasName, options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async deleteSafe(
    aliasName: string,
    options?: RequestOptions,
  ): Promise<Result<MessageResponse, VersioningError>> {
    const parsedName = safeParse(
      aliasName,
      (value) => refNameSchema.parse(value),
      "Input validation failed",
    );
    if (!parsedName.ok) return parsedName;
    return requestVersioning(this.client, {
      method: "DELETE",
      path: pathFor(this.collectionName, `/aliases/${encodeURIComponent(parsedName.value)}`),
      responseSchema: messageResponseSchema,
      successStatus: 200,
      conflict: "catalog",
    }, options);
  }
}
