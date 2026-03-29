// ---------------------------------------------------------------------------
// Benford's Law analysis
//
// Benford's Law predicts that, in many naturally occurring datasets, the
// leading digit d (1–9) appears with probability log10(1 + 1/d).
//
// Deviation from this distribution is measured with a chi-squared test on
// 8 degrees of freedom (9 bins − 1).  A p-value below 0.01 indicates a
// statistically significant departure and is flagged as an anomaly.
// ---------------------------------------------------------------------------

/**
 * Expected frequencies for leading digits 1–9 under Benford's Law.
 * Index 0 corresponds to digit 1, index 8 to digit 9.
 */
export const BENFORD_EXPECTED: readonly number[] = [
  0.301, // log10(2/1)
  0.176, // log10(3/2)
  0.125, // log10(4/3)
  0.097, // log10(5/4)
  0.079, // log10(6/5)
  0.067, // log10(7/6)
  0.058, // log10(8/7)
  0.051, // log10(9/8)
  0.046, // log10(10/9)
] as const;

export interface BenfordResult {
  /** Observed relative frequencies for digits 1–9 (index 0 = digit 1). */
  observedFrequencies: number[];
  /** Benford's expected relative frequencies (same indexing). */
  expectedFrequencies: number[];
  chiSquared: number;
  /** Approximate two-tailed p-value for 8 degrees of freedom. */
  pValue: number;
  /** True when pValue < 0.01. */
  isAnomaly: boolean;
  /** Number of valid (non-zero, finite, positive) values analysed. */
  sampleSize: number;
}

// ---------------------------------------------------------------------------
// Leading-digit extraction
// ---------------------------------------------------------------------------

/**
 * Return the leading significant digit (1–9) of a numeric value.
 * Returns 0 for zero, negative, non-finite, or NaN inputs (caller should
 * exclude these before analysis).
 */
export function getLeadingDigit(value: number): number {
  if (!isFinite(value) || isNaN(value) || value <= 0) return 0;

  // Move the decimal so that the value is in [1, 10), then floor it.
  const abs = Math.abs(value);
  const magnitude = Math.floor(Math.log10(abs));
  const normalised = abs / Math.pow(10, magnitude);
  return Math.floor(normalised); // in {1, 2, …, 9}
}

// ---------------------------------------------------------------------------
// Chi-squared test with p-value approximation
// ---------------------------------------------------------------------------

/**
 * Compute the chi-squared statistic and an approximate p-value for the
 * goodness-of-fit test against Benford's expected distribution.
 *
 * The p-value is approximated using the regularised upper incomplete gamma
 * function P(k/2, χ²/2) via a continued-fraction / series expansion.
 * This matches standard statistical libraries to within ~1 × 10⁻⁵ for the
 * range of chi-squared values encountered in practice.
 *
 * @param observed  Array of observed counts for digits 1–9 (length 9).
 * @param expected  Array of expected relative frequencies (length 9).
 * @param n         Total number of observations (sum of `observed`).
 */
export function chiSquaredTest(
  observed: number[],
  expected: number[],
  n: number,
): { chiSquared: number; pValue: number } {
  if (n === 0) return { chiSquared: 0, pValue: 1 };

  let chiSquared = 0;
  for (let i = 0; i < 9; i++) {
    const expectedCount = (expected[i] as number) * n;
    if (expectedCount === 0) continue;
    const diff = (observed[i] as number) - expectedCount;
    chiSquared += (diff * diff) / expectedCount;
  }

  // Benford test uses 9 bins → 8 degrees of freedom.
  const pValue = chiSquaredSurvival(chiSquared, 8);
  return { chiSquared, pValue };
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Analyse an array of numeric values for conformance to Benford's Law.
 *
 * Non-positive, non-finite, and NaN values are silently excluded because
 * Benford's Law only applies to positive, naturally occurring magnitudes.
 */
export function analyzeBenford(values: number[]): BenfordResult {
  const counts = new Array<number>(9).fill(0);

  let sampleSize = 0;
  for (const v of values) {
    const d = getLeadingDigit(v);
    if (d >= 1 && d <= 9) {
      counts[d - 1]++;
      sampleSize++;
    }
  }

  const observedFrequencies = counts.map((c) =>
    sampleSize > 0 ? c / sampleSize : 0,
  );

  const { chiSquared, pValue } = chiSquaredTest(
    counts,
    BENFORD_EXPECTED as number[],
    sampleSize,
  );

  return {
    observedFrequencies,
    expectedFrequencies: [...BENFORD_EXPECTED],
    chiSquared,
    pValue,
    isAnomaly: pValue < 0.01,
    sampleSize,
  };
}

// ---------------------------------------------------------------------------
// Regularised upper incomplete gamma function (survival function)
//
// We need:  p-value = P(χ² > x | df) = 1 − regularisedGammaP(df/2, x/2)
//                                     = regularisedGammaQ(df/2, x/2)
//
// Implementation uses the Lanczos/series approach from "Numerical Recipes".
// Accuracy: ~1e-10 for the range encountered in chi-squared testing.
// ---------------------------------------------------------------------------

/**
 * Log-gamma function via Lanczos approximation (g=7, n=9 coefficients).
 * Accurate to ~1.5 × 10⁻¹² for Re(z) > 0.5.
 */
function logGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    // Reflection formula: Γ(z)Γ(1−z) = π / sin(πz)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  const zz = z - 1;
  let x = c[0] as number;
  for (let i = 1; i < g + 2; i++) {
    x += (c[i] as number) / (zz + i);
  }
  const t = zz + g + 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (zz + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
}

/**
 * Regularised lower incomplete gamma function P(a, x) via series expansion.
 * Converges rapidly for x < a + 1.
 */
function gammaIncSeries(a: number, x: number): number {
  if (x < 0) return 0;
  const logGammaA = logGamma(a);
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let i = 0; i < 200; i++) {
    ap++;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGammaA);
}

/**
 * Regularised upper incomplete gamma function Q(a, x) = 1 − P(a, x) via
 * continued-fraction representation.  Converges rapidly for x > a + 1.
 */
function gammaIncContinuedFraction(a: number, x: number): number {
  const logGammaA = logGamma(a);
  // Lentz's algorithm for evaluating the continued fraction.
  const fpMin = 1e-300;
  let b = x + 1 - a;
  let c = 1 / fpMin;
  let d = 1 / (b < fpMin ? fpMin : b);
  let h = d;

  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpMin) d = fpMin;
    c = b + an / c;
    if (Math.abs(c) < fpMin) c = fpMin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }

  return Math.exp(-x + a * Math.log(x) - logGammaA) * h;
}

/**
 * Survival function of the chi-squared distribution:
 * P(X > chiSq | df) = Q(df/2, chiSq/2).
 *
 * Returns the probability that a chi-squared random variable with `df`
 * degrees of freedom exceeds `chiSq`.  This is the p-value for a
 * goodness-of-fit test.
 */
function chiSquaredSurvival(chiSq: number, df: number): number {
  if (chiSq <= 0) return 1;
  const a = df / 2;
  const x = chiSq / 2;
  // Use series for small x, continued fraction for large x.
  if (x < a + 1) {
    return 1 - gammaIncSeries(a, x);
  }
  return gammaIncContinuedFraction(a, x);
}
