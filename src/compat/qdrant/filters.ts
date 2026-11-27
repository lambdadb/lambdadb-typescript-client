import {
  QdrantCompatValidationError,
  UnsupportedQdrantFeatureError,
} from "./errors.js";

type JsonObject = { [key: string]: unknown };
type LambdaDBQuery = { [key: string]: unknown };
type Occur = "filter" | "should" | "must_not";
const FIELD_PATH = /^[\p{L}\p{N}_][\p{L}\p{N}_-]*(?:\.[\p{L}\p{N}_][\p{L}\p{N}_-]*)*$/u;
const QUERY_OPERATOR = /^(AND|OR|NOT)$/;

export function filterToLambdaDB(filter: unknown): LambdaDBQuery | undefined {
  if (filter == null) return undefined;
  if (!isObject(filter)) {
    throw new QdrantCompatValidationError("Qdrant filter must be an object");
  }
  assertSupportedKeys(filter, ["must", "should", "mustNot", "must_not"], "filter");

  const required = conditionQueries(filter["must"], "must");
  const alternatives = conditionQueries(filter["should"], "should");
  const excluded = conditionQueries(
    selectAlias(filter["mustNot"], filter["must_not"], "mustNot", "must_not"),
    "must_not",
  );

  // A Qdrant should clause remains required even in the presence of must clauses.
  if (alternatives.length > 0) required.push(group(alternatives, "should"));
  if (excluded.length === 0) {
    return required.length === 0 ? undefined : group(required, "filter");
  }

  // Lucene BooleanQuery matches nothing when all clauses are prohibited.
  if (required.length === 0) required.push(queryString("*:*"));
  return {
    bool: [
      ...withOccur(required, "filter"),
      ...withOccur(excluded, "must_not"),
    ],
  };
}

export function selectAlias<T>(
  first: T | null | undefined,
  second: T | null | undefined,
  firstName: string,
  secondName: string,
): T | undefined {
  if (first != null && second != null && first !== second) {
    throw new QdrantCompatValidationError(`Specify only one of ${firstName} or ${secondName}`);
  }
  return first ?? second ?? undefined;
}

export function pointIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new QdrantCompatValidationError("Point IDs must be a non-empty array");
  }
  return Array.from(ids, (id: unknown) => {
    if (typeof id === "string" && id.length > 0) return id;
    if (typeof id === "number" && Number.isSafeInteger(id) && id >= 0) return String(id);
    throw new QdrantCompatValidationError("Point IDs must be non-empty strings or non-negative safe integers");
  });
}

function conditionQueries(value: unknown, clause: string): LambdaDBQuery[] {
  if (value == null) return [];
  if (!Array.isArray(value) || (clause === "should" && value.length === 0)) {
    throw new QdrantCompatValidationError(
      clause === "should" ? "Qdrant should must be a non-empty array" : `Qdrant ${clause} must be an array`,
    );
  }
  return Array.from(value, conditionQuery);
}

function conditionQuery(condition: unknown): LambdaDBQuery {
  if (!isObject(condition)) {
    throw new QdrantCompatValidationError("Qdrant filter condition must be an object");
  }
  if ("hasId" in condition || "has_id" in condition) {
    assertSupportedKeys(condition, ["hasId", "has_id"], "has_id condition");
    const ids = pointIds(selectAlias(condition["hasId"], condition["has_id"], "hasId", "has_id"));
    return group(ids.map((id) => queryString(`id:${formatLiteral(id)}`)), "should");
  }
  if ("key" in condition) {
    assertSupportedKeys(condition, ["key", "match", "range"], "field condition");
    const { key, match, range } = condition;
    if (typeof key !== "string" || !FIELD_PATH.test(key) || QUERY_OPERATOR.test(key)) {
      throw new UnsupportedQdrantFeatureError("Qdrant field key cannot be represented in a LambdaDB filter");
    }
    if (match != null && range != null) {
      throw new UnsupportedQdrantFeatureError("Combining match and range in one Qdrant field condition is unsupported");
    }
    if (match != null) return matchQuery(key, match);
    if (range != null) return queryString(rangeQuery(key, range));
    throw new QdrantCompatValidationError("FieldCondition must include match or range");
  }

  throw new UnsupportedQdrantFeatureError("Unsupported Qdrant filter condition");
}

function matchQuery(field: string, match: unknown): LambdaDBQuery {
  if (!isObject(match)) {
    throw new QdrantCompatValidationError("Qdrant match must be an object");
  }
  assertSupportedKeys(match, ["value", "any", "except", "except_", "text"], "match");
  if ("except" in match || "except_" in match) {
    throw new UnsupportedQdrantFeatureError("MatchExcept cannot be represented in a LambdaDB filter");
  }

  const variants = ["value", "any", "text"].filter((key) => key in match);
  if (variants.length !== 1) {
    throw new QdrantCompatValidationError("Qdrant match must include exactly one of value, any, or text");
  }
  if ("value" in match) {
    const value = match["value"];
    if (typeof value !== "boolean" && !isMatchAnyValue(value)) {
      throw new QdrantCompatValidationError("MatchValue must contain a string, boolean, or safe integer");
    }
    return queryString(`${field}:${formatLiteral(value)}`);
  }
  if ("any" in match) {
    const values = match["any"];
    if (!Array.isArray(values) || values.length === 0) {
      throw new QdrantCompatValidationError("MatchAny must contain a non-empty array");
    }
    const queries = Array.from(values, (value: unknown) => {
      if (!isMatchAnyValue(value) || typeof value !== typeof values[0]) {
        throw new QdrantCompatValidationError("MatchAny must contain only strings or only safe integers");
      }
      return queryString(`${field}:${formatLiteral(value)}`);
    });
    return group(queries, "should");
  }

  const text = match["text"];
  if (typeof text !== "string" || text.trim() === "") {
    throw new QdrantCompatValidationError("MatchText must contain non-empty text");
  }
  const terms = text.trim().split(/\s+/);
  if (!terms.every((term) => /^[\p{L}\p{N}]+$/u.test(term))) {
    throw new UnsupportedQdrantFeatureError("MatchText supports whitespace-separated words and numbers");
  }
  return group(terms.map((term) => queryString(`${field}:${formatLiteral(term)}`)), "filter");
}

function rangeQuery(field: string, range: unknown): string {
  if (!isObject(range)) {
    throw new QdrantCompatValidationError("Qdrant range must be an object");
  }
  assertSupportedKeys(range, ["gt", "gte", "lt", "lte"], "range");

  const { gt, gte, lt, lte } = range;
  if ((gt != null && gte != null) || (lt != null && lte != null)) {
    throw new QdrantCompatValidationError("Specify one bound per side in a Qdrant range");
  }
  const lower = gt ?? gte;
  const upper = lt ?? lte;
  if (lower == null && upper == null) {
    throw new QdrantCompatValidationError("Qdrant range must contain at least one bound");
  }
  if (lower != null && upper != null && typeof lower !== typeof upper) {
    throw new QdrantCompatValidationError("Qdrant range bounds must have the same type");
  }

  const left = gt != null ? "{" : "[";
  const right = lt != null ? "}" : "]";
  return `${field}:${left}${formatRangeBound(lower)} TO ${formatRangeBound(upper)}${right}`;
}

function formatRangeBound(value: unknown): string {
  if (value == null) return "*";
  if (typeof value === "number" && Number.isFinite(value)) {
    // The backend's DecimalFormat requires an uppercase exponent without a plus sign.
    return String(value).replace(/e\+?/, "E");
  }
  if (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
      Number.isFinite(Date.parse(value))) {
    return formatLiteral(value);
  }
  throw new UnsupportedQdrantFeatureError("Qdrant range requires finite numbers or ISO 8601 datetimes with millisecond precision and a time zone");
}

export function assertSupportedKeys(object: JsonObject, allowed: string[], context: string): void {
  for (const [key, value] of Object.entries(object)) {
    if (value != null && !allowed.includes(key)) {
      throw new UnsupportedQdrantFeatureError(`Unsupported Qdrant ${context} property: ${key}`);
    }
  }
}

function group(queries: LambdaDBQuery[], occur: "should" | "filter"): LambdaDBQuery {
  const [first] = queries;
  if (queries.length === 1 && first !== undefined) return first;
  return { bool: withOccur(queries, occur) };
}

function withOccur(queries: LambdaDBQuery[], occur: Occur): LambdaDBQuery[] {
  return queries.map((query) => ({ ...query, occur }));
}

function queryString(query: string): LambdaDBQuery {
  return { queryString: { query } };
}

function isMatchAnyValue(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isSafeInteger(value));
}

function formatLiteral(value: string | number | boolean): string {
  const text = String(value);
  return isBareTerm(text) ? text : `"${text.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function isBareTerm(value: string): boolean {
  return /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u.test(value) && !QUERY_OPERATOR.test(value);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
