import {
  FieldCondition,
  Filter,
  HasIdCondition,
  MatchAny,
  MatchExcept,
  MatchText,
  MatchValue,
  Range,
  type Condition,
} from "./models.js";
import {
  QdrantCompatValidationError,
  UnsupportedQdrantFeatureError,
} from "./errors.js";

type JsonObject = { [key: string]: unknown };
type LambdaDBQuery = { [key: string]: unknown };

export function filterToLambdaDB(qdrantFilter: Filter | JsonObject | null | undefined): LambdaDBQuery {
  if (qdrantFilter == null) return {};
  const filter = filterFromAny(qdrantFilter);

  const clauses: LambdaDBQuery[] = [];
  if (filter.must) appendBoolClauses(clauses, filter.must, "filter");
  if (filter.should) appendBoolClauses(clauses, filter.should, "should");
  if (filter.mustNot) appendBoolClauses(clauses, filter.mustNot, "must_not");

  if (clauses.length === 0) return {};
  if (clauses.length === 1) {
    const [clause] = clauses;
    const singleClause = { ...clause };
    delete singleClause["occur"];
    return singleClause;
  }
  return { bool: clauses };
}

function appendBoolClauses(
  clauses: LambdaDBQuery[],
  conditions: Condition[],
  occur: "filter" | "should" | "must_not",
): void {
  for (const condition of conditions) {
    const conditionQueries = conditionQueriesFromAny(condition);
    const rawMatch = rawConditionMatch(condition);
    const negateMatchExcept = isMatchExceptLike(rawMatch);
    const effectiveOccur = negateMatchExcept && occur !== "must_not"
      ? "must_not"
      : occur;
    for (const query of conditionQueries) {
      clauses.push({ ...query, occur: effectiveOccur });
    }
  }
}

function conditionQueriesFromAny(condition: Condition): LambdaDBQuery[] {
  const normalized = conditionFromAny(condition);
  if (normalized instanceof HasIdCondition) {
    return normalized.hasId.map((id) => queryString(`id:${formatScalar(id)}`));
  }

  if (!(normalized instanceof FieldCondition)) {
    throw new UnsupportedQdrantFeatureError(
      `Unsupported Qdrant filter condition: ${JSON.stringify(condition)}`,
    );
  }

  const queries: LambdaDBQuery[] = [];
  if (normalized.match !== undefined) {
    queries.push(...matchQueries(normalized.key, normalized.match));
  }
  if (normalized.range !== undefined) {
    queries.push(queryString(rangeQuery(normalized.key, normalized.range)));
  }
  if (queries.length === 0) {
    throw new QdrantCompatValidationError("FieldCondition must include match or range");
  }
  return queries;
}

function matchQueries(field: string, rawMatch: unknown): LambdaDBQuery[] {
  const match = matchFromAny(rawMatch);

  if (match instanceof MatchValue) {
    return [queryString(`${field}:${formatScalar(match.value)}`)];
  }
  if (match instanceof MatchAny) {
    return match.any.map((value) => queryString(`${field}:${formatScalar(value)}`));
  }
  if (match instanceof MatchExcept) {
    return match.except.map((value) => queryString(`${field}:${formatScalar(value)}`));
  }
  if (match instanceof MatchText) {
    throw new UnsupportedQdrantFeatureError(
      "MatchText is not supported in the v1 Qdrant compatibility filter",
    );
  }

  throw new UnsupportedQdrantFeatureError(
    `Unsupported Qdrant match condition: ${JSON.stringify(rawMatch)}`,
  );
}

function rangeQuery(field: string, rawRange: Range | JsonObject): string {
  const range = rawRange instanceof Range
    ? rawRange
    : new Range(rawRange);
  let lower = "*";
  let upper = "*";
  let left = "[";
  let right = "]";

  if (range.gte !== undefined && range.gte !== null) {
    lower = formatScalar(range.gte);
  } else if (range.gt !== undefined && range.gt !== null) {
    lower = formatScalar(range.gt);
    left = "{";
  }

  if (range.lte !== undefined && range.lte !== null) {
    upper = formatScalar(range.lte);
  } else if (range.lt !== undefined && range.lt !== null) {
    upper = formatScalar(range.lt);
    right = "}";
  }

  return `${field}:${left}${lower} TO ${upper}${right}`;
}

function filterFromAny(value: Filter | JsonObject): Filter {
  if (value instanceof Filter) return value;
  if (isObject(value)) return new Filter(value);
  throw new QdrantCompatValidationError("queryFilter must be a Filter or object");
}

function conditionFromAny(condition: Condition): FieldCondition | HasIdCondition {
  if (condition instanceof FieldCondition || condition instanceof HasIdCondition) {
    return condition;
  }
  if (isObject(condition)) {
    if ("key" in condition) {
      return new FieldCondition(condition as {
        key: string;
        match?: JsonObject | null;
        range?: JsonObject | null;
      });
    }
    if ("has_id" in condition || "hasId" in condition) {
      return new HasIdCondition(condition as {
        has_id?: Array<string | number>;
        hasId?: Array<string | number>;
      });
    }
  }
  throw new UnsupportedQdrantFeatureError(
    `Unsupported Qdrant filter condition: ${JSON.stringify(condition)}`,
  );
}

function matchFromAny(value: unknown): unknown {
  if (
    value instanceof MatchValue ||
    value instanceof MatchAny ||
    value instanceof MatchExcept ||
    value instanceof MatchText
  ) {
    return value;
  }
  if (isObject(value)) {
    if ("value" in value) return new MatchValue({ value: value["value"] });
    if ("any" in value && Array.isArray(value["any"])) {
      return new MatchAny({ any: value["any"] });
    }
    if ("except" in value && Array.isArray(value["except"])) {
      return new MatchExcept({ except: value["except"] });
    }
    if ("except_" in value && Array.isArray(value["except_"])) {
      return new MatchExcept({ except_: value["except_"] });
    }
    if ("text" in value && typeof value["text"] === "string") {
      return new MatchText({ text: value["text"] });
    }
  }
  return value;
}

function rawConditionMatch(condition: Condition): unknown {
  if (condition instanceof FieldCondition) return condition.match;
  if (isObject(condition) && "match" in condition) return condition["match"];
  return undefined;
}

function isMatchExceptLike(value: unknown): boolean {
  return value instanceof MatchExcept ||
    (isObject(value) && ("except" in value || "except_" in value));
}

function queryString(query: string): LambdaDBQuery {
  return { queryString: { query } };
}

function formatScalar(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const text = String(value);
  const escaped = text.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  return /[\s:/]/.test(escaped) ? `"${escaped}"` : escaped;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
