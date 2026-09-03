import * as z from "zod/v3";

import type { LambdaDBCore } from "./core.js";
import * as M from "./lib/matchers.js";
import { compactMap } from "./lib/primitives.js";
import { safeParse } from "./lib/schemas.js";
import type { RequestOptions } from "./lib/sdks.js";
import { extractSecurity, resolveGlobalSecurity } from "./lib/security.js";
import * as errors from "./models/errors/index.js";
import type { LambdaDBError } from "./models/errors/lambdadberror.js";
import type { ResponseValidationError } from "./models/errors/responsevalidationerror.js";
import type { SDKValidationError } from "./models/errors/sdkvalidationerror.js";
import {
  AliasDetails$inboundSchema,
  AliasTarget$schema,
  RefDetails$inboundSchema,
  RefSource$schema,
  type AliasRef,
  type BranchRef,
  type BranchSource,
  type TagRef,
  type TagSource,
} from "./models/versioning.js";
import type {
  ConnectionError,
  InvalidRequestError,
  RequestAbortedError,
  RequestTimeoutError,
  UnexpectedClientError,
} from "./models/errors/httpclienterrors.js";
import {
  aliasDetailsWithDate,
  refDetailsWithDate,
  type AliasResponse,
  type CreateAliasInput,
  type CreateBranchInput,
  type CreateBranchResponse,
  type CreateTagInput,
  type CreateTagResponse,
  type ListAliasesResponse,
  type ListBranchesResponse,
  type ListTagsResponse,
  type MessageResponse,
  type RetargetAliasInput,
} from "./types/public.js";
import type { Result } from "./types/fp.js";

/** Exact public contract revision implemented by this SDK. */
export const DATA_VERSIONING_CONTRACT_REVISION =
  "63e07d6b2e281704aa3367fbeb94f40f519241b8" as const;

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

/** Creates a validated Branch source, optionally at a Unix-millisecond cutoff. */
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

/** Creates a validated Tag source. `asOf` is intentionally unavailable. */
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
  | errors.TooManyRequestsError
  | errors.InternalServerError
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
  bodySchema?: z.ZodType<TInput> | undefined;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  responseSchema: z.ZodType<TOutput>;
  successStatus: 200 | 201;
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
      (value) => request.bodySchema?.parse(value) as TInput,
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
  const [result] = await M.match<TOutput, VersioningError>(
    M.json(request.successStatus, request.responseSchema),
    M.jsonErr(400, errors.BadRequestError$inboundSchema),
    M.jsonErr(401, errors.UnauthenticatedError$inboundSchema),
    M.jsonErr(404, errors.ResourceNotFoundError$inboundSchema),
    M.jsonErr(409, errors.ResourceAlreadyExistsError$inboundSchema),
    M.jsonErr(429, errors.TooManyRequestsError$inboundSchema),
    M.jsonErr(500, errors.InternalServerError$inboundSchema),
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

const createBranchSchema: z.ZodType<CreateBranchInput> = z.object({
  branchName: z.string().regex(refNamePattern),
  source: RefSource$schema.optional(),
}).strict();
const createBranchResponseSchema = z.object({ branch: RefDetails$inboundSchema });
const listBranchesResponseSchema = z.object({ branches: z.array(RefDetails$inboundSchema) });

const createTagSchema: z.ZodType<CreateTagInput> = z.object({
  tagName: z.string().regex(refNamePattern),
  source: RefSource$schema.optional(),
}).strict();
const createTagResponseSchema = z.object({ tag: RefDetails$inboundSchema });
const listTagsResponseSchema = z.object({ tags: z.array(RefDetails$inboundSchema) });

const createAliasSchema: z.ZodType<CreateAliasInput> = z.object({
  aliasName: z.string().regex(refNamePattern),
  target: AliasTarget$schema,
}).strict();
const retargetAliasSchema: z.ZodType<RetargetAliasInput> = z.object({
  target: AliasTarget$schema,
}).strict();
const aliasResponseSchema = z.object({ alias: AliasDetails$inboundSchema });
const listAliasesResponseSchema = z.object({ aliases: z.array(AliasDetails$inboundSchema) });
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
      responseSchema: createBranchResponseSchema,
      successStatus: 201,
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { branch: refDetailsWithDate(result.value.branch) } };
  }

  async list(options?: RequestOptions): Promise<ListBranchesResponse> {
    const result = await this.listSafe(options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async listSafe(options?: RequestOptions): Promise<Result<ListBranchesResponse, VersioningError>> {
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, "/branches"),
      responseSchema: listBranchesResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { branches: result.value.branches.map(refDetailsWithDate) } };
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
      responseSchema: createTagResponseSchema,
      successStatus: 201,
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { tag: refDetailsWithDate(result.value.tag) } };
  }

  async list(options?: RequestOptions): Promise<ListTagsResponse> {
    const result = await this.listSafe(options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async listSafe(options?: RequestOptions): Promise<Result<ListTagsResponse, VersioningError>> {
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, "/tags"),
      responseSchema: listTagsResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { tags: result.value.tags.map(refDetailsWithDate) } };
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
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { alias: aliasDetailsWithDate(result.value.alias) } };
  }

  async list(options?: RequestOptions): Promise<ListAliasesResponse> {
    const result = await this.listSafe(options);
    if (!result.ok) throw result.error;
    return result.value;
  }

  async listSafe(options?: RequestOptions): Promise<Result<ListAliasesResponse, VersioningError>> {
    const result = await requestVersioning(this.client, {
      method: "GET",
      path: pathFor(this.collectionName, "/aliases"),
      responseSchema: listAliasesResponseSchema,
      successStatus: 200,
    }, options);
    if (!result.ok) return result;
    return { ok: true, value: { aliases: result.value.aliases.map(aliasDetailsWithDate) } };
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
    }, options);
  }
}
