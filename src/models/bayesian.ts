/** Opt-in hybrid search contract at backend c49da19629d8fd3ce2144ead97b6f8e2b985c3bb. */

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
