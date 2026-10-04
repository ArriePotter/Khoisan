import { RACE } from "../config";
import { addDays, dayIndex, daysBetween } from "../dates";
import type { Proposal, ReadinessLevel, Session, SkeletonWeek } from "../types";
import type { Availability } from "./templates";
import { parseExerciseLine } from "./exercises";

// Hard limits every plan change must satisfy, whoever proposed it. These are
// what make automatic changes safe to apply without a human approving them.

export const LIMITS = {
  /** Planned week may exceed the skeleton target by at most this factor. */
  maxAboveSkeleton: 1.05,
  /** ...and may not drop below this share of it (bigger cuts require a rebase). */
  minOfSkeleton: 0.5,
  /** Growth cap vs. recent actual volume: best recent week * factor + bonus km. */
  growthFactor: 1.12,
  growthBonusKm: 3,
  /** Session totals must land within this tolerance of the week's target. */
  totalTolerance: 0.1,
  /** Longest single run vs. longest recent run. */
  longRunGrowth: 1.15,
  longRunBonusKm: 3,
  /** Well under the athletes' rule of never running 60 km or more in one go before race day. */
  longRunAbsoluteMaxKm: 42,
  longRunShareMax: 0.55,
  maxHardSessions: 2,
  maxHardSessionsEasyWeek: 1,
  maxSessionMinutes: 480,
  maxVertPerKm: 120,
};

export interface GuardContext {
  skeleton: SkeletonWeek;
  /** Actual km of recent completed weeks, oldest first. */
  recentWeeklyKm: number[];
  /** Longest single run in the last ~6 weeks. */
  recentLongestKm: number;
  /** First date the proposal is allowed to touch (today when mid-week). */
  fromDate: string;
  mode: "weekly" | "daily";
  /** Daily mode: the sessions currently planned for the remaining days. */
  original?: Session[];
  readiness?: ReadinessLevel;
  /** Days the athlete can train and their long-run day. */
  availability?: Availability;
}

const WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const isHard = (s: Session) => s.intensity === "hard" && s.type !== "race";
const isGym = (s: Session) => s.type === "strength" || s.type === "mobility";
const isRun = (s: Session) => s.type !== "rest" && !isGym(s);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function growthCapKm(recentWeeklyKm: number[]): number | null {
  if (recentWeeklyKm.length === 0) return null;
  // Measured from the best recent week, so returning to form after a cutback week is allowed.
  return Math.max(...recentWeeklyKm) * LIMITS.growthFactor + LIMITS.growthBonusKm;
}

export function longRunCapKm(recentLongestKm: number): number {
  return Math.min(
    LIMITS.longRunAbsoluteMaxKm,
    Math.max(recentLongestKm * LIMITS.longRunGrowth + LIMITS.longRunBonusKm, 12),
  );
}

export function validateProposal(p: Proposal, ctx: GuardContext): string[] {
  const errors: string[] = [];
  const { skeleton } = ctx;
  const weekEnd = addDays(skeleton.weekStart, 6);
  const start = ctx.fromDate > skeleton.weekStart ? ctx.fromDate : skeleton.weekStart;
  const expectedDays = daysBetween(start, weekEnd) + 1;
  const isRaceWeek = skeleton.phase === "race";
  const nonRace = p.sessions.filter((s) => s.type !== "race");

  // 1. Calendar coverage
  const dates = p.sessions.map((s) => s.date);
  if (new Set(dates).size !== dates.length) errors.push("Each date may appear only once.");
  for (const s of p.sessions) {
    if (s.date < start || s.date > weekEnd) errors.push(`Session on ${s.date} is outside ${start}..${weekEnd}.`);
  }
  if (p.sessions.length !== expectedDays) {
    errors.push(`Expected exactly ${expectedDays} sessions (one per day ${start}..${weekEnd}, rest days included), got ${p.sessions.length}.`);
  }

  // 2. Session sanity
  for (const s of p.sessions) {
    if (!isRun(s) && s.distanceKm > 0) errors.push(`${s.date}: rest/strength/mobility days must have distanceKm 0.`);
    if (s.distanceKm < 0 || s.vertM < 0 || s.durationMin < 0) errors.push(`${s.date}: negative values.`);
    if (s.type !== "race" && s.durationMin > LIMITS.maxSessionMinutes) errors.push(`${s.date}: session longer than ${LIMITS.maxSessionMinutes} min.`);
    if (s.distanceKm > 0 && s.vertM / s.distanceKm > LIMITS.maxVertPerKm) errors.push(`${s.date}: more than ${LIMITS.maxVertPerKm} m climbing per km.`);
  }

  // Keep sessions scannable: runs are steps only, strength/mobility an exercise list; one short note.
  for (const s of p.sessions) {
    const lines = s.description.split("\n").map((l) => l.trim()).filter(Boolean);
    if (isGym(s)) {
      const bad = lines.filter((l) => !parseExerciseLine(l));
      if (bad.length) errors.push(`${s.date}: ${s.type} sessions list exercises from the library, one per line ("split-squat 3x10 each"); not valid: "${bad[0].slice(0, 40)}".`);
      if (lines.length === 0) errors.push(`${s.date}: ${s.type} session needs at least one exercise.`);
      if (lines.length > 6) errors.push(`${s.date}: list at most 6 exercises.`);
    } else {
      const prose = lines.filter((l) => !/^- \S/.test(l) && !/^\d+x$/i.test(l));
      if (prose.length) errors.push(`${s.date}: description must contain only workout steps ("- 10m Z2 HR", "6x"); found "${prose[0].slice(0, 40)}".`);
    }
    if (lines.some((l) => l.length > 50)) errors.push(`${s.date}: description lines must be short (max 50 characters).`);
    if (s.note.length > 90) errors.push(`${s.date}: note must be one short line (max 90 characters).`);
  }

  // 3. Race week is locked to the race.
  const raceSessions = p.sessions.filter((s) => s.type === "race");
  if (isRaceWeek) {
    if (RACE.date >= start && !raceSessions.some((s) => s.date === RACE.date)) errors.push(`Race week must contain the race on ${RACE.date}.`);
  } else if (raceSessions.length > 0) {
    errors.push("Only race week may contain a race session.");
  }

  // 4. Weekly volume vs. skeleton and vs. what the athlete has actually been doing.
  if (p.targetKm > skeleton.targetKm * LIMITS.maxAboveSkeleton) {
    errors.push(`targetKm ${p.targetKm} exceeds the plan's ${skeleton.targetKm} km by more than ${Math.round((LIMITS.maxAboveSkeleton - 1) * 100)}%.`);
  }
  if (p.targetKm < skeleton.targetKm * LIMITS.minOfSkeleton) {
    errors.push(`targetKm ${p.targetKm} is below ${Math.round(LIMITS.minOfSkeleton * 100)}% of the plan's ${skeleton.targetKm} km.`);
  }
  const cap = growthCapKm(ctx.recentWeeklyKm);
  if (ctx.mode === "weekly" && !isRaceWeek && cap !== null && p.targetKm > cap) {
    errors.push(`targetKm ${p.targetKm} grows too fast; recent volume allows at most ${cap.toFixed(1)} km.`);
  }
  const plannedKm = sum(nonRace.map((s) => s.distanceKm));
  if (plannedKm > p.targetKm * (1 + LIMITS.totalTolerance) + 0.5) {
    errors.push(`Sessions total ${plannedKm.toFixed(1)} km, more than targetKm ${p.targetKm} (+${LIMITS.totalTolerance * 100}%).`);
  }
  if (ctx.mode === "weekly" && expectedDays === 7 && !isRaceWeek && plannedKm < p.targetKm * (1 - LIMITS.totalTolerance) - 0.5) {
    errors.push(`Sessions total ${plannedKm.toFixed(1)} km, well under targetKm ${p.targetKm}.`);
  }

  // 5. Long run limits
  const longest = nonRace.reduce((m, s) => Math.max(m, s.distanceKm), 0);
  const longCap = longRunCapKm(ctx.recentLongestKm);
  if (longest > longCap) errors.push(`Longest run ${longest} km exceeds the safe cap of ${longCap.toFixed(1)} km.`);
  if (expectedDays === 7 && p.targetKm >= 30 && longest > p.targetKm * LIMITS.longRunShareMax) {
    errors.push(`Longest run ${longest} km is more than ${LIMITS.longRunShareMax * 100}% of the week.`);
  }

  // 6. Intensity distribution
  const easyWeek = skeleton.isCutback || skeleton.phase === "taper" || isRaceWeek;
  const maxHard = isRaceWeek ? 0 : easyWeek ? LIMITS.maxHardSessionsEasyWeek : LIMITS.maxHardSessions;
  const hardCount = p.sessions.filter(isHard).length;
  if (hardCount > maxHard) errors.push(`${hardCount} hard sessions; at most ${maxHard} allowed this week.`);
  const byDate = new Map(p.sessions.map((s) => [s.date, s]));
  const longRunDistance = Math.max(longest, 0);
  for (const s of p.sessions) {
    const next = byDate.get(addDays(s.date, 1));
    if (!next) continue;
    if (isHard(s) && isHard(next)) errors.push(`Hard sessions on consecutive days (${s.date}, ${next.date}).`);
    const nextIsLong = next.type === "long" || (longRunDistance > 0 && next.distanceKm === longRunDistance && next.distanceKm >= 15);
    if (isHard(s) && nextIsLong) errors.push(`Hard session on ${s.date} right before the long run.`);
  }

  // 7. At least one full rest day in a full week.
  if (expectedDays >= 6 && !p.sessions.some((s) => s.type === "rest" || isGym(s))) {
    errors.push("A full week needs at least one rest day.");
  }

  // 8. Only train on the athlete's days; long run on their long-run day.
  if (ctx.availability && !isRaceWeek) {
    const { trainingDays, longRunDay } = ctx.availability;
    for (const s of p.sessions) {
      if (isRun(s) && !trainingDays.includes(dayIndex(s.date))) errors.push(`${s.date} is a ${WEEKDAY[dayIndex(s.date)]}, which is not a training day.`);
    }
    const longRun = nonRace.find((s) => s.distanceKm === longest && longest > 0);
    const longDate = addDays(skeleton.weekStart, longRunDay);
    if (ctx.mode === "weekly" && longRun && longDate >= start && dayIndex(longRun.date) !== longRunDay) {
      errors.push(`The long run must be on ${WEEKDAY[longRunDay]}.`);
    }
  }

  // 9. Daily adjustments may only reduce or reshuffle, never add load.
  if (ctx.mode === "daily" && ctx.original) {
    const originalKm = sum(ctx.original.filter((s) => s.type !== "race").map((s) => s.distanceKm));
    if (plannedKm > originalKm + 0.5) errors.push(`Daily adjustment raises remaining volume from ${originalKm} to ${plannedKm.toFixed(1)} km.`);
    const originalHard = ctx.original.filter(isHard).length;
    if (hardCount > originalHard) errors.push("Daily adjustment adds hard sessions.");
    const today = p.sessions.find((s) => s.date === ctx.fromDate);
    if (ctx.readiness === "red" && today && (today.intensity === "hard" || today.intensity === "moderate")) {
      errors.push("Readiness is red: today must be rest or easy.");
    }
  }

  return errors;
}
