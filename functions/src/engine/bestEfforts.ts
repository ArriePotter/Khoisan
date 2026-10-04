/** Distances we track fastest efforts for. Any run long enough counts: a 10K also contains a 5K, 2 miles, 1 mile and 1K. */
export const EFFORTS = [
  { key: "1k", label: "1 km", meters: 1000, minSeconds: 150 },
  { key: "1mi", label: "1 mile", meters: 1609.344, minSeconds: 225 },
  { key: "2mi", label: "2 miles", meters: 3218.688, minSeconds: 470 },
  { key: "5k", label: "5 km", meters: 5000, minSeconds: 750 },
  { key: "10k", label: "10 km", meters: 10000, minSeconds: 1560 },
] as const;
// minSeconds sits just under world-record pace, so GPS glitches can't become "bests".

export type EffortKey = (typeof EFFORTS)[number]["key"];

/** Bump when effort/analysis logic changes so existing activities get recomputed on the next sync. */
export const EFFORTS_VERSION = 2;

/**
 * Fastest time (seconds) to cover `targetM` metres within one activity, from
 * cumulative time/distance streams. Interpolates the window end so a split
 * is exact even with 1 s sampling gaps. Returns null if the run is too short.
 */
export function fastestSegmentS(time: number[], distance: number[], targetM: number): number | null {
  const n = Math.min(time.length, distance.length);
  if (n < 2 || distance[n - 1] - distance[0] < targetM) return null;

  let best = Infinity;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const goal = distance[i] + targetM;
    if (j < i) j = i;
    while (j < n && distance[j] < goal) j++;
    if (j >= n) break;
    const span = distance[j] - distance[j - 1];
    const frac = span > 0 ? (goal - distance[j - 1]) / span : 1;
    const endT = time[j - 1] + frac * (time[j] - time[j - 1]);
    best = Math.min(best, endT - time[i]);
  }
  return Number.isFinite(best) ? Math.round(best) : null;
}

/** Every tracked effort that fits inside this run, ignoring physically implausible ones. */
export function bestEfforts(time: number[], distance: number[]): Partial<Record<EffortKey, number>> {
  const out: Partial<Record<EffortKey, number>> = {};
  for (const e of EFFORTS) {
    const t = fastestSegmentS(time, distance, e.meters);
    if (t !== null && t >= e.minSeconds) out[e.key] = t;
  }
  return out;
}
