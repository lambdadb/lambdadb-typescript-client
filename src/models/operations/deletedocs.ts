/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */

import * as z from "zod";
import { remap as remap$ } from "../../lib/primitives.js";
import { safeParse } from "../../lib/schemas.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";

/**
 * Query filter.
 */
export type Filter = {};

export type RequestBody2 = {
  /**
   * Query filter.
   */
  filter: Filter;
};

export type RequestBody1 = {
  /**
   * A list of document IDs.
   */
  ids: Array<string>;
};

export type DeleteDocsRequestBody = RequestBody1 | RequestBody2;

export type DeleteDocsRequest = {
  /**
   * Project name.
   */
  projectName: string;
  /**
   * Collection name.
   */
  collectionName: string;
  requestBody: RequestBody1 | RequestBody2;
};

/**
 * Delete request accepted.
 */
export type DeleteDocsResponse = {
  message?: string | undefined;
};

/** @internal */
export const Filter$inboundSchema: z.ZodType<Filter, z.ZodTypeDef, unknown> = z
  .object({});

/** @internal */
export type Filter$Outbound = {};

/** @internal */
export const Filter$outboundSchema: z.ZodType<
  Filter$Outbound,
  z.ZodTypeDef,
  Filter
> = z.object({});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace Filter$ {
  /** @deprecated use `Filter$inboundSchema` instead. */
  export const inboundSchema = Filter$inboundSchema;
  /** @deprecated use `Filter$outboundSchema` instead. */
  export const outboundSchema = Filter$outboundSchema;
  /** @deprecated use `Filter$Outbound` instead. */
  export type Outbound = Filter$Outbound;
}

export function filterToJSON(filter: Filter): string {
  return JSON.stringify(Filter$outboundSchema.parse(filter));
}

export function filterFromJSON(
  jsonString: string,
): SafeParseResult<Filter, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => Filter$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'Filter' from JSON`,
  );
}

/** @internal */
export const RequestBody2$inboundSchema: z.ZodType<
  RequestBody2,
  z.ZodTypeDef,
  unknown
> = z.object({
  filter: z.lazy(() => Filter$inboundSchema),
});

/** @internal */
export type RequestBody2$Outbound = {
  filter: Filter$Outbound;
};

/** @internal */
export const RequestBody2$outboundSchema: z.ZodType<
  RequestBody2$Outbound,
  z.ZodTypeDef,
  RequestBody2
> = z.object({
  filter: z.lazy(() => Filter$outboundSchema),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace RequestBody2$ {
  /** @deprecated use `RequestBody2$inboundSchema` instead. */
  export const inboundSchema = RequestBody2$inboundSchema;
  /** @deprecated use `RequestBody2$outboundSchema` instead. */
  export const outboundSchema = RequestBody2$outboundSchema;
  /** @deprecated use `RequestBody2$Outbound` instead. */
  export type Outbound = RequestBody2$Outbound;
}

export function requestBody2ToJSON(requestBody2: RequestBody2): string {
  return JSON.stringify(RequestBody2$outboundSchema.parse(requestBody2));
}

export function requestBody2FromJSON(
  jsonString: string,
): SafeParseResult<RequestBody2, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => RequestBody2$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'RequestBody2' from JSON`,
  );
}

/** @internal */
export const RequestBody1$inboundSchema: z.ZodType<
  RequestBody1,
  z.ZodTypeDef,
  unknown
> = z.object({
  ids: z.array(z.string()),
});

/** @internal */
export type RequestBody1$Outbound = {
  ids: Array<string>;
};

/** @internal */
export const RequestBody1$outboundSchema: z.ZodType<
  RequestBody1$Outbound,
  z.ZodTypeDef,
  RequestBody1
> = z.object({
  ids: z.array(z.string()),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace RequestBody1$ {
  /** @deprecated use `RequestBody1$inboundSchema` instead. */
  export const inboundSchema = RequestBody1$inboundSchema;
  /** @deprecated use `RequestBody1$outboundSchema` instead. */
  export const outboundSchema = RequestBody1$outboundSchema;
  /** @deprecated use `RequestBody1$Outbound` instead. */
  export type Outbound = RequestBody1$Outbound;
}

export function requestBody1ToJSON(requestBody1: RequestBody1): string {
  return JSON.stringify(RequestBody1$outboundSchema.parse(requestBody1));
}

export function requestBody1FromJSON(
  jsonString: string,
): SafeParseResult<RequestBody1, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => RequestBody1$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'RequestBody1' from JSON`,
  );
}

/** @internal */
export const DeleteDocsRequestBody$inboundSchema: z.ZodType<
  DeleteDocsRequestBody,
  z.ZodTypeDef,
  unknown
> = z.union([
  z.lazy(() => RequestBody1$inboundSchema),
  z.lazy(() => RequestBody2$inboundSchema),
]);

/** @internal */
export type DeleteDocsRequestBody$Outbound =
  | RequestBody1$Outbound
  | RequestBody2$Outbound;

/** @internal */
export const DeleteDocsRequestBody$outboundSchema: z.ZodType<
  DeleteDocsRequestBody$Outbound,
  z.ZodTypeDef,
  DeleteDocsRequestBody
> = z.union([
  z.lazy(() => RequestBody1$outboundSchema),
  z.lazy(() => RequestBody2$outboundSchema),
]);

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace DeleteDocsRequestBody$ {
  /** @deprecated use `DeleteDocsRequestBody$inboundSchema` instead. */
  export const inboundSchema = DeleteDocsRequestBody$inboundSchema;
  /** @deprecated use `DeleteDocsRequestBody$outboundSchema` instead. */
  export const outboundSchema = DeleteDocsRequestBody$outboundSchema;
  /** @deprecated use `DeleteDocsRequestBody$Outbound` instead. */
  export type Outbound = DeleteDocsRequestBody$Outbound;
}

export function deleteDocsRequestBodyToJSON(
  deleteDocsRequestBody: DeleteDocsRequestBody,
): string {
  return JSON.stringify(
    DeleteDocsRequestBody$outboundSchema.parse(deleteDocsRequestBody),
  );
}

export function deleteDocsRequestBodyFromJSON(
  jsonString: string,
): SafeParseResult<DeleteDocsRequestBody, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => DeleteDocsRequestBody$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'DeleteDocsRequestBody' from JSON`,
  );
}

/** @internal */
export const DeleteDocsRequest$inboundSchema: z.ZodType<
  DeleteDocsRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  projectName: z.string(),
  collectionName: z.string(),
  RequestBody: z.union([
    z.lazy(() => RequestBody1$inboundSchema),
    z.lazy(() => RequestBody2$inboundSchema),
  ]),
}).transform((v) => {
  return remap$(v, {
    "RequestBody": "requestBody",
  });
});

/** @internal */
export type DeleteDocsRequest$Outbound = {
  projectName: string;
  collectionName: string;
  RequestBody: RequestBody1$Outbound | RequestBody2$Outbound;
};

/** @internal */
export const DeleteDocsRequest$outboundSchema: z.ZodType<
  DeleteDocsRequest$Outbound,
  z.ZodTypeDef,
  DeleteDocsRequest
> = z.object({
  projectName: z.string(),
  collectionName: z.string(),
  requestBody: z.union([
    z.lazy(() => RequestBody1$outboundSchema),
    z.lazy(() => RequestBody2$outboundSchema),
  ]),
}).transform((v) => {
  return remap$(v, {
    requestBody: "RequestBody",
  });
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace DeleteDocsRequest$ {
  /** @deprecated use `DeleteDocsRequest$inboundSchema` instead. */
  export const inboundSchema = DeleteDocsRequest$inboundSchema;
  /** @deprecated use `DeleteDocsRequest$outboundSchema` instead. */
  export const outboundSchema = DeleteDocsRequest$outboundSchema;
  /** @deprecated use `DeleteDocsRequest$Outbound` instead. */
  export type Outbound = DeleteDocsRequest$Outbound;
}

export function deleteDocsRequestToJSON(
  deleteDocsRequest: DeleteDocsRequest,
): string {
  return JSON.stringify(
    DeleteDocsRequest$outboundSchema.parse(deleteDocsRequest),
  );
}

export function deleteDocsRequestFromJSON(
  jsonString: string,
): SafeParseResult<DeleteDocsRequest, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => DeleteDocsRequest$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'DeleteDocsRequest' from JSON`,
  );
}

/** @internal */
export const DeleteDocsResponse$inboundSchema: z.ZodType<
  DeleteDocsResponse,
  z.ZodTypeDef,
  unknown
> = z.object({
  message: z.string().optional(),
});

/** @internal */
export type DeleteDocsResponse$Outbound = {
  message?: string | undefined;
};

/** @internal */
export const DeleteDocsResponse$outboundSchema: z.ZodType<
  DeleteDocsResponse$Outbound,
  z.ZodTypeDef,
  DeleteDocsResponse
> = z.object({
  message: z.string().optional(),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace DeleteDocsResponse$ {
  /** @deprecated use `DeleteDocsResponse$inboundSchema` instead. */
  export const inboundSchema = DeleteDocsResponse$inboundSchema;
  /** @deprecated use `DeleteDocsResponse$outboundSchema` instead. */
  export const outboundSchema = DeleteDocsResponse$outboundSchema;
  /** @deprecated use `DeleteDocsResponse$Outbound` instead. */
  export type Outbound = DeleteDocsResponse$Outbound;
}

export function deleteDocsResponseToJSON(
  deleteDocsResponse: DeleteDocsResponse,
): string {
  return JSON.stringify(
    DeleteDocsResponse$outboundSchema.parse(deleteDocsResponse),
  );
}

export function deleteDocsResponseFromJSON(
  jsonString: string,
): SafeParseResult<DeleteDocsResponse, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => DeleteDocsResponse$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'DeleteDocsResponse' from JSON`,
  );
}
