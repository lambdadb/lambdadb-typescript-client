/** Managed reranking DTOs, maintained manually following docs/OPENAPI_UPDATE.md. */
import * as z from "zod/v3";
import { nullToUndefined } from "../lib/schemas.js";

/** Per-query fixed managed model; credentials are managed by the server. */
export type RerankConfig = {
  provider: "typesafe";
  model: "jev-1.13.0";
  /** Nonblank text, at most 8 KiB UTF-8; sent unchanged. */
  queryText: string;
  /** 1–8 unique stored scalar text paths, in model input order. */
  fields: string[];
  /** Defaults on the server to max(50, size); does not change knn.k. */
  candidateSize?: number | null | undefined;
  /** Server default: error. Only eligible provider failures can returnOriginal. */
  onFailure?: "error" | "returnOriginal" | null | undefined;
  /** 2–10 distinct nonblank descriptions, lowest to highest relevance; null uses defaults. */
  criteria?: string[] | null | undefined;
};

export type RerankResponse = {
  status: "applied" | "skipped" | "fallback";
  provider: string;
  model: string;
  resolvedModel?: string | undefined;
  candidateCount: number;
  scoredCount: number;
  /** Rerank stage duration in milliseconds. */
  took: number;
  /** Only applied results report this marker; custom is not a content identity. */
  criteriaVersion?: "default-relevance-v1" | "custom" | undefined;
  reason?: string | undefined;
};

// Match Java String.isBlank; do not trim or normalize caller text.
// eslint-disable-next-line no-control-regex -- Java whitespace includes these control characters.
const blank = /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]*$/u;
const nonblank = z.string().refine((text) => !blank.test(text), "Must be nonblank");
const bytes = (text: string) => new TextEncoder().encode(text).length;

/** @internal */
export const RerankConfig$outboundSchema: z.ZodType<RerankConfig> = z.object({
  provider: z.literal("typesafe"),
  model: z.literal("jev-1.13.0"),
  queryText: nonblank.refine((text) => bytes(text) <= 8192, "queryText exceeds 8 KiB UTF-8"),
  fields: z.array(nonblank.refine(
    (path) => path.split(".").every((part) => !blank.test(part)), "Invalid field path",
  )).min(1).max(8).refine((paths) => new Set(paths).size === paths.length, "Fields must be unique"),
  candidateSize: z.number().int().min(1).max(100).nullable().optional(),
  onFailure: z.enum(["error", "returnOriginal"]).nullable().optional(),
  criteria: z.array(nonblank.refine(
    (text) => bytes(text) <= 2048, "Criterion exceeds 2 KiB UTF-8",
  )).min(2).max(10).refine(
    (texts) => new Set(texts).size === texts.length, "Criteria must be distinct",
  ).refine(
    (texts) => texts.reduce((total, text) => total + bytes(text), 0) <= 8192,
    "Criteria exceed 8 KiB total UTF-8",
  ).nullable().optional(),
}).strict();

/** @internal */
export const RerankResponse$inboundSchema: z.ZodType<RerankResponse, z.ZodTypeDef, unknown> = z.object({
  status: z.enum(["applied", "skipped", "fallback"]),
  provider: z.string(),
  model: z.string(),
  resolvedModel: nullToUndefined(z.string().optional()),
  candidateCount: z.number().int().nonnegative(),
  scoredCount: z.number().int().nonnegative(),
  took: z.number().int().nonnegative(),
  criteriaVersion: nullToUndefined(z.enum(["default-relevance-v1", "custom"]).optional()),
  reason: nullToUndefined(z.string().optional()),
});

/** @internal: mirrors ManagedRerankService.hasScoringQuery for the existing wire DSL. */
export function hasRerankScoringQuery(query: unknown): boolean {
  if (query == null || typeof query !== "object" || Array.isArray(query)) return false;
  const node = query as Record<string, unknown>;
  const occur = typeof node["occur"] === "string" ? node["occur"].toUpperCase() : undefined;
  if (occur === "FILTER" || occur === "MUST_NOT") return false;
  // Follow backend parser precedence for composite queries.
  for (const key of ["bool", "rrf", "bayesian", "mm", "l2"]) {
    // Undefined members are omitted by JSON serialization.
    if (node[key] !== undefined) {
      const children = node[key];
      return Array.isArray(children) && children.some(hasRerankScoringQuery);
    }
  }
  return ["queryString", "sparseVector", "knn"].some((key) => node[key] != null);
}
