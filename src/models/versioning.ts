import * as z from "zod/v3";

import {
  IndexConfigsUnion,
  IndexConfigsUnion$inboundSchema,
} from "./indexconfigsunion.js";

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
  /**
   * Selects the latest retained committed snapshot at or before this Unix epoch
   * millisecond cutoff. Inherited and pending writes are excluded; this is not
   * an exact-time restore of accepted writes.
   */
  asOf?: number | undefined;
};

export type TagSource = TagRef;

/** A Branch or Tag used as the source of a new Branch or Tag. */
export type RefSource = BranchSource | TagSource;

/** A Branch or Tag used as the target of an Alias. */
export type AliasTarget = BranchRef | TagRef;

export type SnapshotDetails = {
  snapshotId: string;
  /** Snapshot commit time as Unix epoch milliseconds. */
  snapshotCommittedAt: number;
};

/** Historical direct source identity, independent of snapshot origin. */
export type ParentBranchDetails = {
  branchId: string;
  name: string;
};

export type BranchDetails = {
  name: string;
  /**
   * Fixed direct source, even for an empty head or an ancestor snapshot selected
   * by asOf. Null for main, Branches created from Tags, or unrecorded parents.
   * Survives parent deletion and name reuse; this metadata does not prevent
   * parent deletion.
   */
  parentBranch: ParentBranchDetails | null;
  /** Current committed head; null for an empty branch. */
  headSnapshot: SnapshotDetails | null;
  /**
   * Fixed fork snapshot, not the previous head. Null for main or an empty source.
   * This metadata does not extend snapshot retention.
   */
  parentSnapshot: SnapshotDetails | null;
  /** Document count in this Branch's committed head; 0 for an empty Branch. */
  numDocs: number;
  /**
   * Last data update of this Branch's committed head as Unix epoch
   * milliseconds; null for an empty Branch.
   */
  dataUpdatedAt: number | null;
  /** The Branch's own index schema. */
  indexConfigs: { [k: string]: IndexConfigsUnion };
  /** Branch creation time as Unix epoch milliseconds. */
  createdAt: number;
};

export type TagDetails = {
  name: string;
  /** Current published snapshot ID, or null before the first publication. */
  snapshotId: string | null;
  /** Snapshot commit time in Unix epoch milliseconds, or null before publication. */
  snapshotCommittedAt: number | null;
  /** Document count in the published snapshot, or 0 before publication. */
  numDocs: number;
  /** Last data update in Unix epoch milliseconds, or null before publication. */
  dataUpdatedAt: number | null;
  /**
   * Index schema pinned by the Tag, including inherited writes. With
   * `source.asOf`, this is the selected snapshot's schema.
   */
  indexConfigs: { [k: string]: IndexConfigsUnion };
  /** Tag creation time, independent of the pinned snapshot commit time. */
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
  /**
   * Whether the bound target identity is missing. Document reads through a
   * dangling Alias return 400; reading the Alias itself still succeeds with
   * null indexConfigs.
   */
  dangling: boolean;
  /** Index schema of the target's version; null for a dangling Alias. */
  indexConfigs: { [k: string]: IndexConfigsUnion } | null;
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
export const SnapshotDetails$inboundSchema: z.ZodType<SnapshotDetails> = z.object({
  snapshotId: z.string(),
  snapshotCommittedAt: z.number().int(),
});

/** @internal */
export const ParentBranchDetails$inboundSchema: z.ZodType<ParentBranchDetails> = z.object({
  branchId: z.string(),
  name: z.string(),
});

const indexConfigsInboundSchema = z.record(IndexConfigsUnion$inboundSchema);

/** @internal */
export const BranchDetails$inboundSchema: z.ZodType<
  BranchDetails,
  z.ZodTypeDef,
  unknown
> = z.object({
  name: z.string(),
  parentBranch: ParentBranchDetails$inboundSchema.nullable(),
  headSnapshot: SnapshotDetails$inboundSchema.nullable(),
  parentSnapshot: SnapshotDetails$inboundSchema.nullable(),
  numDocs: z.number().int(),
  dataUpdatedAt: z.number().int().nullable(),
  indexConfigs: indexConfigsInboundSchema,
  createdAt: z.number().int(),
});

/** @internal */
export const TagDetails$inboundSchema: z.ZodType<
  TagDetails,
  z.ZodTypeDef,
  unknown
> = z.object({
  name: z.string(),
  snapshotId: z.string().nullable(),
  snapshotCommittedAt: z.number().int().nullable(),
  numDocs: z.number().int(),
  dataUpdatedAt: z.number().int().nullable(),
  indexConfigs: indexConfigsInboundSchema,
  createdAt: z.number().int(),
});

/** @internal */
export const AliasDetails$inboundSchema: z.ZodType<
  AliasDetails,
  z.ZodTypeDef,
  unknown
> = z.object({
  aliasId: z.string(),
  aliasName: z.string(),
  targetKind: z.enum(["BRANCH", "TAG"]),
  targetName: z.string(),
  targetId: z.string(),
  aliasRevision: z.number().int().nonnegative(),
  dangling: z.boolean(),
  indexConfigs: indexConfigsInboundSchema.nullable(),
  createdAt: z.number().int(),
});
