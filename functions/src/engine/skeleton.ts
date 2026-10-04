import { RACE } from "../config";
import { addDays, daysBetween, mondayOf } from "../dates";
import type { Baseline, Phase, SkeletonWeek } from "../types";

// The skeleton is the deterministic backbone of the plan: phases, weekly volume,
// climbing and long-run progression from today to race week. The AI coach only
// fills in and nudges weeks inside this structure; it never rewrites it.

// Evidence behind these numbers is summarised in docs/training-research.md.
/** ~10%/week: two-week growth stays ~21%, under the >30% injury-risk threshold (Nielsen 2014). */
export const MAX_WEEKLY_GROWTH = 1.1;
const CUTBACK_FACTOR = 0.75;
const CUTBACK_LONG_FACTOR = 0.7;
/** Peak weekly volume for a first mountain 50-60K: beginner/intermediate plans peak ~56-72 km. */
const PEAK_WEEKLY_KM = 70;
/** ~36 km / ~1,900 m race simulation = 6-7 h on feet. Athletes' rule: no training run of 60 km or more. */
export const PEAK_LONG_RUN_KM = 36;
/** 70 km x 32 m/km ~ 2,250 m/week, i.e. ~75% of race climbing. */
const PEAK_VERT_PER_KM = 32;

// weeksOut -> multiplier of peak weekly km / peak long run
const PEAK_BLOCK: Record<number, { km: number; long: number }> = {
  6: { km: 1.0, long: 0.85 },
  5: { km: 1.0, long: 0.75 }, // back-to-back weekend
  4: { km: 1.0, long: 1.0 }, // race simulation long run
  3: { km: 0.85, long: 0.65 },
};
// ~2-week taper, volume down 40-60%, intensity kept.
const TAPER_BLOCK: Record<number, { km: number; long: number }> = {
  2: { km: 0.6, long: 0.5 },
  1: { km: 0.4, long: 0.3 },
};
const RACE_WEEK_KM = 0.2;

export function phaseFor(weeksOut: number): Phase {
  if (weeksOut === 0) return "race";
  if (weeksOut <= 2) return "taper";
  if (weeksOut <= 6) return "peak";
  if (weeksOut <= 14) return "build";
  return "base";
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function buildSkeleton(opts: {
  startDate: string;
  raceDate?: string;
  baseline: Baseline;
}): SkeletonWeek[] {
  const raceDate = opts.raceDate ?? RACE.date;
  const first = mondayOf(opts.startDate);
  const total = daysBetween(first, mondayOf(raceDate)) / 7 + 1;
  if (total < 1) throw new Error("Race date is in the past");

  const meta = Array.from({ length: total }, (_, index) => {
    const weeksOut = total - 1 - index;
    const phase = phaseFor(weeksOut);
    const isCutback = (phase === "base" || phase === "build") && index % 4 === 3;
    return { index, weeksOut, phase, isCutback };
  });

  // Number of progression steps between the starting level and the first peak week.
  const steps =
    meta.filter(
      (w) => w.index > 0 && (w.phase === "base" || w.phase === "build") && !w.isCutback,
    ).length + (meta.some((w) => w.weeksOut === 6 && w.index > 0) ? 1 : 0);

  const startKm = Math.max(Math.round(opts.baseline.weeklyKm), 10);
  const desiredPeak = Math.max(startKm, PEAK_WEEKLY_KM);
  const ratio =
    steps > 0 ? Math.min(MAX_WEEKLY_GROWTH, Math.pow(desiredPeak / startKm, 1 / steps)) : 1;
  const peakKm = startKm * Math.pow(ratio, steps);

  const startLong = clamp(opts.baseline.longestRunKm, 8, PEAK_LONG_RUN_KM);
  const peakLong = Math.max(startLong, Math.min(PEAK_LONG_RUN_KM, startLong + 2 * steps));

  const startVpk =
    opts.baseline.weeklyVertM && opts.baseline.weeklyKm > 0
      ? clamp(opts.baseline.weeklyVertM / opts.baseline.weeklyKm, 5, PEAK_VERT_PER_KM)
      : 15;

  let step = 0;
  return meta.map((w) => {
    let km: number;
    let longRun: number;
    let vpk: number;

    if (w.phase === "base" || w.phase === "build") {
      if (w.index > 0 && !w.isCutback) step++;
      const level = startKm * Math.pow(ratio, step);
      const f = steps > 0 ? step / steps : 1;
      km = w.isCutback ? level * CUTBACK_FACTOR : level;
      longRun = startLong + (peakLong - startLong) * f;
      if (w.isCutback) longRun *= CUTBACK_LONG_FACTOR;
      longRun = Math.min(longRun, km * 0.5);
      vpk = startVpk + (PEAK_VERT_PER_KM - startVpk) * f;
    } else if (w.phase === "peak") {
      const block = PEAK_BLOCK[w.weeksOut];
      km = peakKm * block.km;
      longRun = Math.min(peakLong * block.long, km * 0.55);
      vpk = PEAK_VERT_PER_KM;
    } else if (w.phase === "taper") {
      const block = TAPER_BLOCK[w.weeksOut];
      km = peakKm * block.km;
      longRun = peakLong * block.long;
      vpk = 40;
    } else {
      km = peakKm * RACE_WEEK_KM;
      longRun = RACE.distanceKm;
      vpk = 15;
    }

    return {
      weekStart: addDays(first, w.index * 7),
      index: w.index,
      weeksOut: w.weeksOut,
      phase: w.phase,
      isCutback: w.isCutback,
      targetKm: Math.round(km),
      targetVertM: roundTo(km * vpk, 50),
      longRunKm: roundTo(longRun, 0.5),
    };
  });
}
