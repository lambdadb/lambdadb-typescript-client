/** Opt-in hybrid search contract at backend 9072a1bc8925954369a887f558f1eaf387b7ea0e. */

/** Existing wire query DSL, without nested rank fusion or explicit boosts on this node or Boolean descendants. */
export type BayesianSubquery = {
  [key: string]: unknown;
  boost?: never;
  bayesian?: never;
  rrf?: never;
  mm?: never;
  l2?: never;
  bool?: BayesianSubquery[] | undefined;
};

/** Top-level fusion of exactly two signals; calibration requires no caller weights. */
export type BayesianQuery = {
  bayesian: [BayesianSubquery, BayesianSubquery];
};
