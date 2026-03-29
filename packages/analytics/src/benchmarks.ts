export interface PeerBenchmark {
  metric: string;
  orgValue: number;
  peerMedian: number;
  peerP25: number;
  peerP75: number;
  /** Percentile rank of this organisation within the peer group (0–100). */
  percentile: number;
}

/**
 * Return the percentile rank (0–100) of `value` within a pre-sorted ascending
 * array of peer values.  Uses the "nearest rank" method with linear
 * interpolation so the result is continuous.
 *
 * @param value       The organisation's observed value.
 * @param sortedValues Peer values sorted in ascending order (may include the
 *                    organisation itself or exclude it — caller's choice).
 */
export function computePercentile(
  value: number,
  sortedValues: number[],
): number {
  const n = sortedValues.length;
  if (n === 0) return 50; // no peers — default to median

  // Count how many peer values are strictly below and at the target value.
  let below = 0;
  let equal = 0;
  for (const v of sortedValues) {
    if (v < value) below++;
    else if (v === value) equal++;
  }

  // Percentile using the "inclusive" formula:
  // P = (below + 0.5 * equal) / n * 100
  const percentile = ((below + 0.5 * equal) / n) * 100;
  return Math.min(100, Math.max(0, percentile));
}

/**
 * Compute the median of a pre-sorted ascending array.
 * Returns 0 for an empty array.
 */
export function computeMedian(sortedValues: number[]): number {
  const n = sortedValues.length;
  if (n === 0) return 0;

  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sortedValues[mid] as number;
  }
  return ((sortedValues[mid - 1] as number) + (sortedValues[mid] as number)) / 2;
}

/**
 * Compute the 25th percentile, median, and 75th percentile of a pre-sorted
 * ascending array using linear interpolation (same method as Excel PERCENTILE).
 */
export function computeQuartiles(sortedValues: number[]): {
  p25: number;
  median: number;
  p75: number;
} {
  const n = sortedValues.length;

  if (n === 0) return { p25: 0, median: 0, p75: 0 };
  if (n === 1) {
    const only = sortedValues[0] as number;
    return { p25: only, median: only, p75: only };
  }

  const interpolate = (p: number): number => {
    // p is in [0, 1].  Scale to [0, n-1] index space.
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sortedValues[lo] as number;
    const frac = idx - lo;
    return (
      ((sortedValues[lo] as number) * (1 - frac)) +
      ((sortedValues[hi] as number) * frac)
    );
  };

  return {
    p25: interpolate(0.25),
    median: interpolate(0.5),
    p75: interpolate(0.75),
  };
}

/**
 * Build a PeerBenchmark record by combining an organisation's value with a
 * pre-sorted array of peer values.
 */
export function buildPeerBenchmark(
  metric: string,
  orgValue: number,
  sortedPeerValues: number[],
): PeerBenchmark {
  const { p25, median, p75 } = computeQuartiles(sortedPeerValues);
  return {
    metric,
    orgValue,
    peerMedian: median,
    peerP25: p25,
    peerP75: p75,
    percentile: computePercentile(orgValue, sortedPeerValues),
  };
}
