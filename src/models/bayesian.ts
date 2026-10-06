/** Opt-in hybrid search contract at backend 9072a1bc8925954369a887f558f1eaf387b7ea0e. */

/** Existing wire query DSL, without explicit boosts on this node or Boolean descendants. */
export type BayesianSubquery = {
  [key: string]: unknown;
  boost?: never;
  bool?: BayesianSubquery[] | undefined;
};

/** Top-level fusion of exactly two signals; calibration requires no caller weights. */
export type BayesianQuery = {
  bayesian: [BayesianSubquery, BayesianSubquery];
};
