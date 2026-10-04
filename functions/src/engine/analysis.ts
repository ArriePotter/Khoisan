import { RUN_TYPES } from "../config";
import { addDays } from "../dates";
import type { ActivityDoc } from "../types";

// Run-quality analytics. "Efficiency" = metres covered per heartbeat at
// grade-adjusted pace: it corrects for hills (GAP) and for how hard the body
// worked (heart rate), so a slow hilly run and a fast flat run compare fairly.

/** Filters out GPS glitches and mislabelled activities (e.g. a drive saved as a run). */
export function isPlausibleRun(a: ActivityDoc): boolean {
  if (!RUN_TYPES.has(a.type) || a.distanceKm < 1 || a.movingTimeS < 300) return false;
  const speed = (a.distanceKm * 1000) / a.movingTimeS; // m/s
  if (speed > 6.5) return false; // faster than 2:34/km on average
  if (a.avgHr !== null && a.avgHr < 100 && speed > 3.5) return false; // fast with a resting heart rate: not running
  return true;
}

/** Metres per heartbeat at grade-adjusted pace, or null when the data isn't there. */
export function efficiency(a: ActivityDoc): number | null {
  if (!a.avgHr || a.avgHr < 100 || !a.gapSpeed) return null;
  // Capped heart-rate recordings would make every run look the same.
  if (a.maxHr && a.movingTimeS >= 600 && a.avgHr >= a.maxHr - 3) return null;
  return (a.gapSpeed * 60) / a.avgHr;
}

export interface RunHighlight {
  activityId: string;
  date: string;
  name: string;
  distanceKm: number;
  feel: number | null;
  avgTempC: number | null;
  /** Efficiency relative to the athlete's median run in the window, e.g. +12 or -9. */
  vsTypicalPct: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Strongest and weakest run over the last `days`, judged on efficiency. Needs at least 3 qualifying runs. */
export function strongestAndWeakest(activities: ActivityDoc[], today: string, days = 90): { strongest: RunHighlight; weakest: RunHighlight } | null {
  const scored = activities
    .filter((a) => a.date > addDays(today, -days) && isPlausibleRun(a) && a.distanceKm >= 3 && a.movingTimeS >= 900)
    .map((a) => ({ a, eff: efficiency(a) }))
    .filter((x): x is { a: ActivityDoc; eff: number } => x.eff !== null);
  if (scored.length < 3) return null;

  const typical = median(scored.map((x) => x.eff));
  const highlight = ({ a, eff }: { a: ActivityDoc; eff: number }): RunHighlight => ({
    activityId: a.id,
    date: a.date,
    name: a.name,
    distanceKm: a.distanceKm,
    feel: a.feel ?? null,
    avgTempC: a.avgTempC ?? null,
    vsTypicalPct: Math.round((eff / typical - 1) * 100),
  });
  const sorted = [...scored].sort((x, y) => y.eff - x.eff);
  return { strongest: highlight(sorted[0]), weakest: highlight(sorted[sorted.length - 1]) };
}
