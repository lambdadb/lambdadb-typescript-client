import * as z from "zod/v3";

// Mirrors Java String.isBlank, which is the server-side contract. In
// particular, NBSP (U+00A0), figure space (U+2007), and narrow NBSP (U+202F)
// are not considered blank by Java.
const javaWhitespaceCodePoints = new Set([
  ...Array.from({ length: 5 }, (_, index) => 0x0009 + index),
  ...Array.from({ length: 5 }, (_, index) => 0x001c + index),
  0x1680,
  ...Array.from({ length: 7 }, (_, index) => 0x2000 + index),
  ...Array.from({ length: 3 }, (_, index) => 0x2008 + index),
  0x2028,
  0x2029,
  0x205f,
  0x3000,
]);

function isJavaBlank(value: string): boolean {
  return Array.from(value).every((character) =>
    javaWhitespaceCodePoints.has(character.codePointAt(0) ?? -1)
  );
}

const collectionTagValueSchema = z.string()
  .min(1)
  .max(127)
  .regex(/^[^:#,]+$/)
  .refine((value) => !isJavaBlank(value), {
    message: "Collection tag values must contain a non-whitespace character",
  });

/** @internal */
export const collectionTagsSchema = z.record(collectionTagValueSchema)
  .refine((value) => Object.keys(value).length <= 5, {
    message: "Collection tags support at most five entries",
  })
  .refine(
    (value) => Object.keys(value).every((key) =>
      /^[A-Za-z0-9_.-]{1,63}$/.test(key)
    ),
    { message: "Invalid collection tag key" },
  );
