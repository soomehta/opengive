export type { FinancialData, ComputedRatios } from "./ratios.js";
export { computeRatios, computeRevenueGrowth } from "./ratios.js";

export type { PeerBenchmark } from "./benchmarks.js";
export {
  computePercentile,
  computeMedian,
  computeQuartiles,
  buildPeerBenchmark,
} from "./benchmarks.js";

export type { ScoringInput, ScoreResult } from "./scoring.js";
export { computeScore } from "./scoring.js";

export type { BenfordResult } from "./benford.js";
export {
  BENFORD_EXPECTED,
  analyzeBenford,
  getLeadingDigit,
  chiSquaredTest,
} from "./benford.js";
