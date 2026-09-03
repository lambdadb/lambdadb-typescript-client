import * as z from "zod/v3";

const refNameSchema = z.string().regex(/^[a-zA-Z0-9_-]{3,52}$/);

export type BranchRef = {
  kind: "branch";
  name: string;
};

export type TagRef = {
  kind: "tag";
  name: string;
};

export type AliasRef = {
  kind: "alias";
  name: string;
};

/** A Branch, Tag, or Alias used to select document reads. */
export type ReadRef = BranchRef | TagRef | AliasRef;

export type BranchSource = BranchRef & {
  /** Latest committed snapshot cutoff as Unix epoch milliseconds. */
  asOf?: number | undefined;
};

export type TagSource = TagRef;

/** A Branch or Tag used as the source of a new Branch or Tag. */
export type RefSource = BranchSource | TagSource;

/** A Branch or Tag used as the target of an Alias. */
export type AliasTarget = BranchRef | TagRef;

export type RefDetails = {
  name: string;
  snapshotId: string | null;
  /** Ref creation time as Unix epoch milliseconds. */
  createdAt: number;
};

export type AliasTargetKind = "BRANCH" | "TAG";

export type AliasDetails = {
  aliasId: string;
  aliasName: string;
  targetKind: AliasTargetKind;
  targetName: string;
  targetId: string;
  aliasRevision: number;
  dangling: boolean;
  /** Alias creation time as Unix epoch milliseconds. */
  createdAt: number;
};

/** @internal */
export const BranchRef$schema = z.object({
  kind: z.literal("branch"),
  name: refNameSchema,
}).strict();

/** @internal */
export const TagRef$schema = z.object({
  kind: z.literal("tag"),
  name: refNameSchema,
}).strict();

/** @internal */
export const AliasRef$schema = z.object({
  kind: z.literal("alias"),
  name: refNameSchema,
}).strict();

/** @internal */
export const ReadRef$schema: z.ZodType<ReadRef> = z.discriminatedUnion("kind", [
  BranchRef$schema,
  TagRef$schema,
  AliasRef$schema,
]);

/** @internal */
export const BranchSource$schema = z.object({
  kind: z.literal("branch"),
  name: refNameSchema,
  asOf: z.number().int().optional(),
}).strict();

/** @internal */
export const RefSource$schema: z.ZodType<RefSource> = z.union([
  BranchSource$schema,
  TagRef$schema,
]);

/** @internal */
export const AliasTarget$schema: z.ZodType<AliasTarget> = z.union([
  BranchRef$schema,
  TagRef$schema,
]);

/** @internal */
export const RefDetails$inboundSchema: z.ZodType<RefDetails> = z.object({
  name: z.string(),
  snapshotId: z.string().nullable(),
  createdAt: z.number().int(),
});

/** @internal */
export const AliasDetails$inboundSchema: z.ZodType<AliasDetails> = z.object({
  aliasId: z.string(),
  aliasName: z.string(),
  targetKind: z.enum(["BRANCH", "TAG"]),
  targetName: z.string(),
  targetId: z.string(),
  aliasRevision: z.number().int().nonnegative(),
  dangling: z.boolean(),
  createdAt: z.number().int(),
});
