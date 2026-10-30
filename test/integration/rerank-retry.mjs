import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

// Provider timeouts, rate limits and outages are transient under shared load; with
// onFailure "returnOriginal" they arrive as a fallback naming the reason. Retry only
// those, a bounded number of times. Credential, invalid-response and any other
// fallback fails at once, and a fallback never counts as applied reranking.
const transientRerankReasons = new Set(["timeout", "rateLimit", "unavailable"]);
const rerankAttempts = 3;

// send(request) performs one query and returns its response or throws.
// A request that sets onFailure itself is sent once, unchanged, so that contract stays covered.
export async function rerankQuery(send, request, label) {
  if (request.rerank?.onFailure !== undefined) return send(request);
  const withFallback = { ...request, rerank: { ...request.rerank, onFailure: "returnOriginal" } };
  for (let attempt = 1; ; attempt++) {
    const response = await send(withFallback);
    if (response.rerank?.status !== "fallback") return response;
    const { reason } = response.rerank;
    // Documented fallback shape: retrieval order without rerank scores or criteria.
    assert.equal(response.rerank.scoredCount, 0, `${label} fallback must not report scores`);
    assert.equal(response.rerank.criteriaVersion, undefined, `${label} fallback must omit criteriaVersion`);
    assert.ok(response.docs.length <= request.size);
    assert.ok(response.docs.every((hit) => hit.retrievalScore === undefined), `${label} fallback must omit retrievalScore`);
    assert.ok(transientRerankReasons.has(reason) && attempt < rerankAttempts,
      `${label} fell back with reason ${reason} on attempt ${attempt}/${rerankAttempts}`);
    console.info(`[live] ${label} fell back with reason ${reason}; retrying (${attempt + 1}/${rerankAttempts})`);
    await delay(attempt * 5_000);
  }
}
