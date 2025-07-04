/*
 * Code generated by Speakeasy (https://speakeasy.com). DO NOT EDIT.
 */

import * as z from "zod";
import { remap as remap$ } from "../../lib/primitives.js";
import { safeParse } from "../../lib/schemas.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
import * as models from "../index.js";

export type UpdateCollectionRequestBody = {
  indexConfigs: { [k: string]: models.IndexConfigsUnion };
};

export type UpdateCollectionRequest = {
  /**
   * Project name.
   */
  projectName: string;
  /**
   * Collection name.
   */
  collectionName: string;
  requestBody: UpdateCollectionRequestBody;
};

/** @internal */
export const UpdateCollectionRequestBody$inboundSchema: z.ZodType<
  UpdateCollectionRequestBody,
  z.ZodTypeDef,
  unknown
> = z.object({
  indexConfigs: z.record(models.IndexConfigsUnion$inboundSchema),
});

/** @internal */
export type UpdateCollectionRequestBody$Outbound = {
  indexConfigs: { [k: string]: models.IndexConfigsUnion$Outbound };
};

/** @internal */
export const UpdateCollectionRequestBody$outboundSchema: z.ZodType<
  UpdateCollectionRequestBody$Outbound,
  z.ZodTypeDef,
  UpdateCollectionRequestBody
> = z.object({
  indexConfigs: z.record(models.IndexConfigsUnion$outboundSchema),
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace UpdateCollectionRequestBody$ {
  /** @deprecated use `UpdateCollectionRequestBody$inboundSchema` instead. */
  export const inboundSchema = UpdateCollectionRequestBody$inboundSchema;
  /** @deprecated use `UpdateCollectionRequestBody$outboundSchema` instead. */
  export const outboundSchema = UpdateCollectionRequestBody$outboundSchema;
  /** @deprecated use `UpdateCollectionRequestBody$Outbound` instead. */
  export type Outbound = UpdateCollectionRequestBody$Outbound;
}

export function updateCollectionRequestBodyToJSON(
  updateCollectionRequestBody: UpdateCollectionRequestBody,
): string {
  return JSON.stringify(
    UpdateCollectionRequestBody$outboundSchema.parse(
      updateCollectionRequestBody,
    ),
  );
}

export function updateCollectionRequestBodyFromJSON(
  jsonString: string,
): SafeParseResult<UpdateCollectionRequestBody, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => UpdateCollectionRequestBody$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'UpdateCollectionRequestBody' from JSON`,
  );
}

/** @internal */
export const UpdateCollectionRequest$inboundSchema: z.ZodType<
  UpdateCollectionRequest,
  z.ZodTypeDef,
  unknown
> = z.object({
  projectName: z.string(),
  collectionName: z.string(),
  RequestBody: z.lazy(() => UpdateCollectionRequestBody$inboundSchema),
}).transform((v) => {
  return remap$(v, {
    "RequestBody": "requestBody",
  });
});

/** @internal */
export type UpdateCollectionRequest$Outbound = {
  projectName: string;
  collectionName: string;
  RequestBody: UpdateCollectionRequestBody$Outbound;
};

/** @internal */
export const UpdateCollectionRequest$outboundSchema: z.ZodType<
  UpdateCollectionRequest$Outbound,
  z.ZodTypeDef,
  UpdateCollectionRequest
> = z.object({
  projectName: z.string(),
  collectionName: z.string(),
  requestBody: z.lazy(() => UpdateCollectionRequestBody$outboundSchema),
}).transform((v) => {
  return remap$(v, {
    requestBody: "RequestBody",
  });
});

/**
 * @internal
 * @deprecated This namespace will be removed in future versions. Use schemas and types that are exported directly from this module.
 */
export namespace UpdateCollectionRequest$ {
  /** @deprecated use `UpdateCollectionRequest$inboundSchema` instead. */
  export const inboundSchema = UpdateCollectionRequest$inboundSchema;
  /** @deprecated use `UpdateCollectionRequest$outboundSchema` instead. */
  export const outboundSchema = UpdateCollectionRequest$outboundSchema;
  /** @deprecated use `UpdateCollectionRequest$Outbound` instead. */
  export type Outbound = UpdateCollectionRequest$Outbound;
}

export function updateCollectionRequestToJSON(
  updateCollectionRequest: UpdateCollectionRequest,
): string {
  return JSON.stringify(
    UpdateCollectionRequest$outboundSchema.parse(updateCollectionRequest),
  );
}

export function updateCollectionRequestFromJSON(
  jsonString: string,
): SafeParseResult<UpdateCollectionRequest, SDKValidationError> {
  return safeParse(
    jsonString,
    (x) => UpdateCollectionRequest$inboundSchema.parse(JSON.parse(x)),
    `Failed to parse 'UpdateCollectionRequest' from JSON`,
  );
}
