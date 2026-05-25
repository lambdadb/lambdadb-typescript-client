type JsonObject = { [key: string]: unknown };

export const Distance = {
  COSINE: "Cosine",
  EUCLID: "Euclid",
  DOT: "Dot",
  MANHATTAN: "Manhattan",
  Cosine: "Cosine",
  Euclid: "Euclid",
  Dot: "Dot",
  Manhattan: "Manhattan",
} as const;
export type Distance = (typeof Distance)[keyof typeof Distance];

export const PayloadSchemaType = {
  KEYWORD: "keyword",
  INTEGER: "integer",
  FLOAT: "float",
  BOOL: "bool",
  DATETIME: "datetime",
  TEXT: "text",
  UUID: "uuid",
  GEO: "geo",
  Keyword: "keyword",
  Integer: "integer",
  Float: "float",
  Bool: "bool",
  Datetime: "datetime",
  Text: "text",
  Uuid: "uuid",
  Geo: "geo",
} as const;
export type PayloadSchemaType =
  (typeof PayloadSchemaType)[keyof typeof PayloadSchemaType];

export const UpdateStatus = {
  ACKNOWLEDGED: "acknowledged",
  COMPLETED: "completed",
} as const;
export type UpdateStatus = (typeof UpdateStatus)[keyof typeof UpdateStatus];

export type PointId = string | number;
export type DenseVector = number[];
export type NamedVector = {
  [name: string]: DenseVector | SparseVector | JsonObject;
};
export type PointVector = DenseVector | NamedVector;

function assignExtras<T extends object>(target: T, init: JsonObject): T {
  for (const [key, value] of Object.entries(init)) {
    if (!(key in target)) {
      Object.assign(target, { [key]: value });
    }
  }
  return target;
}

export class VectorParams {
  size: number;
  distance: Distance;

  constructor(init: { size: number; distance?: Distance | string | undefined }) {
    this.size = init.size;
    this.distance = normalizeDistance(init.distance);
    assignExtras(this, init as JsonObject);
  }
}

export class SparseVector {
  indices: number[];
  values: number[];

  constructor(init: { indices: number[]; values: number[] }) {
    this.indices = init.indices;
    this.values = init.values;
    assignExtras(this, init as JsonObject);
  }
}

export class PointStruct {
  id: PointId;
  vector: PointVector;
  payload: JsonObject | undefined;

  constructor(init: {
    id: PointId;
    vector: PointVector;
    payload?: JsonObject | null | undefined;
  }) {
    this.id = init.id;
    this.vector = init.vector;
    this.payload = init.payload ?? undefined;
    assignExtras(this, init as JsonObject);
  }
}

export class MatchValue {
  value: unknown;

  constructor(init: { value: unknown }) {
    this.value = init.value;
    assignExtras(this, init as JsonObject);
  }
}

export class MatchAny {
  any: unknown[];

  constructor(init: { any: unknown[] }) {
    this.any = init.any;
    assignExtras(this, init as JsonObject);
  }
}

export class MatchExcept {
  except: unknown[];
  except_: unknown[];

  constructor(init: { except?: unknown[] | undefined; except_?: unknown[] | undefined }) {
    this.except = init.except ?? init.except_ ?? [];
    this.except_ = this.except;
    assignExtras(this, init as JsonObject);
  }
}

export class MatchText {
  text: string;

  constructor(init: { text: string }) {
    this.text = init.text;
    assignExtras(this, init as JsonObject);
  }
}

export class Range {
  gt: unknown;
  gte: unknown;
  lt: unknown;
  lte: unknown;

  constructor(init: {
    gt?: unknown;
    gte?: unknown;
    lt?: unknown;
    lte?: unknown;
  }) {
    this.gt = init.gt;
    this.gte = init.gte;
    this.lt = init.lt;
    this.lte = init.lte;
    assignExtras(this, init as JsonObject);
  }
}

export type MatchCondition =
  | MatchValue
  | MatchAny
  | MatchExcept
  | MatchText
  | JsonObject;

export class FieldCondition {
  key: string;
  match: MatchCondition | undefined;
  range: Range | JsonObject | undefined;

  constructor(init: {
    key: string;
    match?: MatchCondition | null | undefined;
    range?: Range | JsonObject | null | undefined;
  }) {
    this.key = init.key;
    this.match = init.match ?? undefined;
    this.range = init.range ?? undefined;
    assignExtras(this, init as JsonObject);
  }
}

export class HasIdCondition {
  hasId: PointId[];
  has_id: PointId[];

  constructor(init: { hasId?: PointId[] | undefined; has_id?: PointId[] | undefined }) {
    this.hasId = init.hasId ?? init.has_id ?? [];
    this.has_id = this.hasId;
    assignExtras(this, init as JsonObject);
  }
}

export type Condition = FieldCondition | HasIdCondition | JsonObject;

export class Filter {
  must: Condition[] | undefined;
  should: Condition[] | undefined;
  mustNot: Condition[] | undefined;
  must_not: Condition[] | undefined;

  constructor(init: {
    must?: Condition[] | null | undefined;
    should?: Condition[] | null | undefined;
    mustNot?: Condition[] | null | undefined;
    must_not?: Condition[] | null | undefined;
  } = {}) {
    this.must = init.must ?? undefined;
    this.should = init.should ?? undefined;
    this.mustNot = init.mustNot ?? init.must_not ?? undefined;
    this.must_not = this.mustNot;
    assignExtras(this, init as JsonObject);
  }
}

export class SearchParams {
  hnswEf: number | undefined;
  hnsw_ef: number | undefined;
  exact: boolean | undefined;

  constructor(init: {
    hnswEf?: number | undefined;
    hnsw_ef?: number | undefined;
    exact?: boolean | undefined;
  } = {}) {
    this.hnswEf = init.hnswEf ?? init.hnsw_ef;
    this.hnsw_ef = this.hnswEf;
    this.exact = init.exact;
    assignExtras(this, init as JsonObject);
  }
}

export class ScoredPoint {
  id: PointId;
  version: number | undefined;
  score: number | undefined;
  payload: JsonObject | undefined;
  vector: unknown;

  constructor(init: {
    id: PointId;
    version?: number | undefined;
    score?: number | undefined;
    payload?: JsonObject | null | undefined;
    vector?: unknown;
  }) {
    this.id = init.id;
    this.version = init.version;
    this.score = init.score;
    this.payload = init.payload ?? undefined;
    this.vector = init.vector;
    assignExtras(this, init as JsonObject);
  }
}

export class Record {
  id: PointId;
  payload: JsonObject | undefined;
  vector: unknown;

  constructor(init: {
    id: PointId;
    payload?: JsonObject | null | undefined;
    vector?: unknown;
  }) {
    this.id = init.id;
    this.payload = init.payload ?? undefined;
    this.vector = init.vector;
    assignExtras(this, init as JsonObject);
  }
}

export class QueryResponse {
  points: ScoredPoint[];

  constructor(init: { points: ScoredPoint[] }) {
    this.points = init.points;
    assignExtras(this, init as JsonObject);
  }
}

export class UpdateResult {
  operationId: PointId | undefined;
  operation_id: PointId | undefined;
  status: UpdateStatus;

  constructor(init: {
    operationId?: PointId | undefined;
    operation_id?: PointId | undefined;
    status?: UpdateStatus | string | undefined;
  } = {}) {
    this.operationId = init.operationId ?? init.operation_id;
    this.operation_id = this.operationId;
    this.status = normalizeUpdateStatus(init.status);
    assignExtras(this, init as JsonObject);
  }
}

export class CountResult {
  count: number;

  constructor(init: { count: number }) {
    this.count = init.count;
    assignExtras(this, init as JsonObject);
  }
}

function normalizeDistance(distance: Distance | string | undefined): Distance {
  const value = distance ?? Distance.COSINE;
  if (value === "Cosine" || value === "cosine") return Distance.COSINE;
  if (value === "Euclid" || value === "euclidean") return Distance.EUCLID;
  if (value === "Dot" || value === "dot_product") return Distance.DOT;
  if (value === "Manhattan" || value === "manhattan") return Distance.MANHATTAN;
  return value as Distance;
}

function normalizeUpdateStatus(status: UpdateStatus | string | undefined): UpdateStatus {
  const value = status ?? UpdateStatus.COMPLETED;
  if (value === UpdateStatus.ACKNOWLEDGED) return UpdateStatus.ACKNOWLEDGED;
  return UpdateStatus.COMPLETED;
}
