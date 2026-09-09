import * as z from "zod/v3";

import { nullToUndefined } from "../../lib/schemas.js";
import { LambdaDBError } from "./lambdadberror.js";

export type GatewayErrorData = {
  message?: string | undefined;
};

type HTTPMeta = {
  response: Response;
  request: Request;
  body: string;
};

class GatewayResponseError extends LambdaDBError {
  /** The structured JSON error returned by the Gateway. */
  readonly data$: GatewayErrorData;

  protected constructor(name: string, err: GatewayErrorData, httpMeta: HTTPMeta) {
    super(
      err.message || `API error occurred: ${JSON.stringify(err)}`,
      httpMeta,
    );
    this.data$ = err;
    this.name = name;
  }
}

/** HTTP 409 conditional catalog conflict. */
export class CatalogConflictError extends GatewayResponseError {
  constructor(err: GatewayErrorData, httpMeta: HTTPMeta) {
    super("CatalogConflictError", err, httpMeta);
  }
}

/** HTTP 413 Gateway transport limit exceeded. */
export class PayloadTooLargeError extends GatewayResponseError {
  constructor(err: GatewayErrorData, httpMeta: HTTPMeta) {
    super("PayloadTooLargeError", err, httpMeta);
  }
}

/** HTTP 502 unexpected downstream failure. */
export class BadGatewayError extends GatewayResponseError {
  constructor(err: GatewayErrorData, httpMeta: HTTPMeta) {
    super("BadGatewayError", err, httpMeta);
  }
}

/** HTTP 503 transient catalog or storage dependency failure. */
export class ServiceUnavailableError extends GatewayResponseError {
  constructor(err: GatewayErrorData, httpMeta: HTTPMeta) {
    super("ServiceUnavailableError", err, httpMeta);
  }
}

/** HTTP 504 Gateway request deadline exceeded. */
export class GatewayTimeoutError extends GatewayResponseError {
  constructor(err: GatewayErrorData, httpMeta: HTTPMeta) {
    super("GatewayTimeoutError", err, httpMeta);
  }
}

type GatewayErrorConstructor<T extends GatewayResponseError> = new (
  err: GatewayErrorData,
  httpMeta: HTTPMeta,
) => T;

function gatewayErrorSchema<T extends GatewayResponseError>(
  ErrorClass: GatewayErrorConstructor<T>,
): z.ZodType<T, z.ZodTypeDef, unknown> {
  return z.object({
    message: nullToUndefined(z.string().optional()),
    request$: z.instanceof(Request),
    response$: z.instanceof(Response),
    body$: z.string(),
  }).transform((value) =>
    new ErrorClass(value, {
      request: value.request$,
      response: value.response$,
      body: value.body$,
    })
  );
}

/** @internal */
export const CatalogConflictError$inboundSchema = gatewayErrorSchema(
  CatalogConflictError,
);
/** @internal */
export const PayloadTooLargeError$inboundSchema = gatewayErrorSchema(
  PayloadTooLargeError,
);
/** @internal */
export const BadGatewayError$inboundSchema = gatewayErrorSchema(BadGatewayError);
/** @internal */
export const ServiceUnavailableError$inboundSchema = gatewayErrorSchema(
  ServiceUnavailableError,
);
/** @internal */
export const GatewayTimeoutError$inboundSchema = gatewayErrorSchema(
  GatewayTimeoutError,
);
