import { RUN_TYPES } from "../config";
import { addDays, mondayOf } from "../dates";
import type { ActivityDoc, HeartRateStatus, WeekPlan, WellnessDoc } from "../types";
import { easySharePct } from "./heartRate";
import { isPlausibleRun, strongestAndWeakest, type RunHighlight } from "./analysis";
import { EFFORTS, type EffortKey } from "./bestEfforts";

export interface WeeklyTotal {
  weekStart: string;
  km: number;
  vertM: number;
  descentM: number;
  runs: number;
  longestKm: number;
}

export interface BestMark {
  timeS: number;
  date: string;
  activityId: string;
}

/** Shared, comparable summary. This is the only per-athlete doc the other athlete can read. */
export interface CompareStats {
  displayName: string;
  updatedAt: string;
  planStart: string | null;
  totalKm: number;
  totalVertM: number;
  totalHours: number;
  last7Km: number;
  last28Km: number;
  /** Fastest time per distance across all synced runs (efforts found inside longer runs count). */
  bests: Record<EffortKey, BestMark | null>;
  longestRun: (BestMark & { distanceKm: number; name: string }) | null;
  /** Best and worst run of the last 90 days by efficiency (grade-adjusted pace per heartbeat). */
  strongestRun: RunHighlight | null;
  weakestRun: RunHighlight | null;
  vo2max: number | null;
  vo2maxSeries: { date: string; value: number }[];
  fitness: number | null;
  compliancePct: number | null;
  /** % of running time in HR zones 1-2 over the last 28 days (target ~80); null without trustworthy HR. */
  easySharePct28: number | null;
  heartRate: HeartRateStatus | null;
  weekly: WeeklyTotal[];
}

export const isRun = (a: Pick<ActivityDoc, "type">) => RUN_TYPES.has(a.type);
const r1 = (v: number) => Math.round(v * 10) / 10;

export function weeklyTotals(activities: ActivityDoc[], fromWeek: string, toWeek: string): WeeklyTotal[] {
  const weeks = new Map<string, WeeklyTotal>();
  for (let w = fromWeek; w <= toWeek; w = addDays(w, 7)) {
    weeks.set(w, { weekStart: w, km: 0, vertM: 0, descentM: 0, runs: 0, longestKm: 0 });
  }
  for (const a of activities) {
    if (!isRun(a)) continue;
    const bucket = weeks.get(mondayOf(a.date));
    if (!bucket) continue;
    bucket.km += a.distanceKm;
    bucket.vertM += a.elevGainM;
    bucket.descentM += a.descentM ?? 0;
    bucket.runs += 1;
    bucket.longestKm = Math.max(bucket.longestKm, a.distanceKm);
  }
  return [...weeks.values()].map((w) => ({ ...w, km: r1(w.km), vertM: Math.round(w.vertM), descentM: Math.round(w.descentM), longestKm: r1(w.longestKm) }));
}

function bestFor(runs: ActivityDoc[], key: EffortKey): BestMark | null {
  let mark: BestMark | null = null;
  for (const a of runs) {
    const t = a.bestEfforts?.[key];
    if (t && (!mark || t < mark.timeS)) mark = { timeS: t, date: a.date, activityId: a.id };
  }
  return mark;
}

/** Share of planned km completed in finished weeks (capped at 100% per week). */
export function compliancePct(weeks: WeekPlan[], totals: WeeklyTotal[], today: string): number | null {
  const actual = new Map(totals.map((t) => [t.weekStart, t.km]));
  let planned = 0;
  let done = 0;
  for (const w of weeks) {
    if (addDays(w.weekStart, 6) >= today || w.source === "none") continue;
    const p = w.sessions.filter((s) => s.type !== "race").reduce((a, s) => a + s.distanceKm, 0);
    if (p <= 0) continue;
    planned += p;
    done += Math.min(actual.get(w.weekStart) ?? 0, p);
  }
  return planned > 0 ? Math.round((done / planned) * 100) : null;
}

export function buildCompareStats(input: {
  displayName: string;
  today: string;
  planStart: string | null;
  activities: ActivityDoc[];
  wellness: WellnessDoc[];
  weeks: WeekPlan[];
  heartRate?: HeartRateStatus | null;
}): CompareStats {
  const { today, activities, wellness } = input;
  const runs = activities.filter(isRun);
  const since = input.planStart ?? addDays(today, -365);
  const inPlan = runs.filter((a) => a.date >= since);
  const sumKm = (xs: ActivityDoc[]) => r1(xs.reduce((s, a) => s + a.distanceKm, 0));

  const plausible = runs.filter(isPlausibleRun);
  const longest = plausible.reduce<ActivityDoc | null>((m, a) => (!m || a.distanceKm > m.distanceKm ? a : m), null);
  const highlights = strongestAndWeakest(plausible, today);
  const currentWeek = mondayOf(today);
  const weekly = weeklyTotals(runs, addDays(currentWeek, -7 * 15), currentWeek);

  const vo2 = wellness
    .filter((w) => typeof w.vo2max === "number" && w.vo2max > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({ date: w.date, value: w.vo2max as number }));
  const latestFitness = [...wellness].sort((a, b) => b.date.localeCompare(a.date)).find((w) => w.ctl !== null);

  return {
    displayName: input.displayName,
    updatedAt: new Date().toISOString(),
    planStart: input.planStart,
    totalKm: sumKm(inPlan),
    totalVertM: Math.round(inPlan.reduce((s, a) => s + a.elevGainM, 0)),
    totalHours: r1(inPlan.reduce((s, a) => s + a.movingTimeS, 0) / 3600),
    last7Km: sumKm(runs.filter((a) => a.date > addDays(today, -7))),
    last28Km: sumKm(runs.filter((a) => a.date > addDays(today, -28))),
    bests: Object.fromEntries(EFFORTS.map((e) => [e.key, bestFor(plausible, e.key)])) as Record<EffortKey, BestMark | null>,
    longestRun: longest ? { timeS: longest.movingTimeS, date: longest.date, activityId: longest.id, distanceKm: longest.distanceKm, name: longest.name } : null,
    strongestRun: highlights?.strongest ?? null,
    weakestRun: highlights?.weakest ?? null,
    vo2max: vo2.length ? vo2[vo2.length - 1].value : null,
    vo2maxSeries: vo2.slice(-120),
    fitness: latestFitness?.ctl != null ? Math.round(latestFitness.ctl) : null,
    easySharePct28: input.heartRate?.reliable === false ? null : easySharePct(runs.filter((a) => a.date > addDays(today, -28))),
    heartRate: input.heartRate ?? null,
    compliancePct: compliancePct(input.weeks, weeklyTotals(runs, since, currentWeek), today),
    weekly,
  };
}
