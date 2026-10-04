import type Anthropic from "@anthropic-ai/sdk";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { BACKFILL_DAYS, DEFAULT_TIMEZONE, RACE, ROUTINE_SYNC_DAYS } from "../config";
import { addDays, daysBetween, localToday, mondayOf } from "../dates";
import { downgradeForReadiness, shouldRebase } from "../engine/adjust";
import { bestEfforts, EFFORTS_VERSION } from "../engine/bestEfforts";
import { isPlausibleRun } from "../engine/analysis";
import { easySharePct, heartRateStatus, isHrClipped, toEffortTargets } from "../engine/heartRate";
import { growthCapKm, LIMITS, longRunCapKm, validateProposal, type GuardContext } from "../engine/guardrails";
import { computeReadiness } from "../engine/readiness";
import { buildSkeleton } from "../engine/skeleton";
import { buildCompareStats, isRun, weeklyTotals } from "../engine/stats";
import { DEFAULT_AVAILABILITY, generateTemplateWeek, type Availability } from "../engine/templates";
import { IntervalsClient, normalizeActivity, normalizeWellness, sessionToEvent } from "../intervals";
import type { ActivityDoc, Baseline, HeartRateStatus, Proposal, Readiness, Session, SkeletonWeek, WeekPlan, WellnessDoc } from "../types";
import { proposePlan } from "./claude";

export interface AthleteProfile {
  uid: string;
  displayName: string;
  email: string;
  timezone: string;
  intervalsAthleteId: string;
  baseline: Baseline;
  planStart: string;
  notes?: string;
  /** Training days (0 = Monday) and long-run day, chosen at setup. */
  availability?: Availability;
  readiness?: Readiness;
  lastSyncAt?: string;
  stravaOnlyActivities?: number;
  effortsVersion?: number;
  heartRate?: HeartRateStatus;
}

const db = () => getFirestore();
const athleteRef = (uid: string) => db().doc(`athletes/${uid}`);
const weekRef = (uid: string, weekStart: string) => db().doc(`athletes/${uid}/weeks/${weekStart}`);

async function loadAthlete(uid: string) {
  const [snap, secret] = await Promise.all([athleteRef(uid).get(), db().doc(`private/${uid}`).get()]);
  if (!snap.exists || !secret.exists) throw new Error(`Athlete ${uid} is not connected`);
  const profile = snap.data() as AthleteProfile;
  const client = new IntervalsClient(profile.intervalsAthleteId, secret.get("intervalsApiKey"));
  return { profile, client, today: localToday(profile.timezone ?? DEFAULT_TIMEZONE) };
}

export async function listAthleteIds(): Promise<string[]> {
  const snap = await db().collection("athletes").select().get();
  return snap.docs.map((d) => d.id);
}

async function commitInChunks(writes: [DocumentReference, object][]) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db().batch();
    for (const [ref, data] of writes.slice(i, i + 400)) batch.set(ref, data, { merge: true });
    await batch.commit();
  }
}

// ---------------------------------------------------------------- onboarding

export async function connectAthlete(
  uid: string,
  email: string,
  input: { displayName: string; intervalsAthleteId: string; intervalsApiKey: string; availability: Availability; timezone?: string; notes?: string },
  anthropic: Anthropic,
) {
  const client = new IntervalsClient(input.intervalsAthleteId, input.intervalsApiKey);
  await client.getAthlete(); // throws on bad credentials

  const timezone = input.timezone || DEFAULT_TIMEZONE;
  const today = localToday(timezone);
  const profile: AthleteProfile = {
    uid,
    email,
    displayName: input.displayName,
    timezone,
    intervalsAthleteId: input.intervalsAthleteId,
    baseline: { weeklyKm: 0, longestRunKm: 0 }, // derived from synced data below
    planStart: today,
    notes: input.notes ?? "",
    availability: input.availability,
  };
  await db().doc(`private/${uid}`).set({ intervalsApiKey: input.intervalsApiKey });
  await athleteRef(uid).set(profile);
  await db().doc(`members/${uid}`).set({ displayName: input.displayName });

  await syncAthlete(uid, BACKFILL_DAYS);
  await buildAndPlan(uid, profile, today, "initial", anthropic);
}

/** Starting point when an athlete has no running history synced yet. */
export const NO_HISTORY_BASELINE: Baseline = { weeklyKm: 10, longestRunKm: 5, weeklyVertM: 100 };

/**
 * Starting point for the season, derived only from synced data: average weekly
 * running over the last 28 days and the longest run in the last 6 weeks.
 */
export function baselineFromHistory(activities: ActivityDoc[], today: string): Baseline {
  const runs = activities.filter((a) => isRun(a) && a.date > addDays(today, -42));
  if (runs.length === 0) return NO_HISTORY_BASELINE;
  const last28 = runs.filter((a) => a.date > addDays(today, -28));
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    weeklyKm: r1(last28.reduce((s, a) => s + a.distanceKm, 0) / 4),
    longestRunKm: r1(runs.reduce((m, a) => Math.max(m, a.distanceKm), 0)),
    weeklyVertM: Math.round(last28.reduce((s, a) => s + a.elevGainM, 0) / 4),
  };
}

async function buildAndPlan(uid: string, profile: AthleteProfile, today: string, kind: "initial" | "rebuild", anthropic: Anthropic | null) {
  const activities = await loadActivities(uid, addDays(today, -60));
  const baseline = baselineFromHistory(activities, today);
  profile.baseline = baseline;
  await athleteRef(uid).set({ baseline }, { merge: true });
  await writeSkeleton(uid, buildSkeleton({ startDate: today, baseline }), { resetPlans: true });

  const readiness = computeReadiness(today, await loadWellness(uid, addDays(today, -61)));
  await athleteRef(uid).set({ readiness }, { merge: true });

  const planKind = kind === "rebuild" ? "manual" : "initial";
  await planWeek(uid, mondayOf(today), { fromDate: today, kind: planKind }, anthropic);
  await planAhead(uid, addDays(mondayOf(today), 7), planKind, anthropic);
  await recomputeStats(uid);
  return baseline;
}

/** Throw away future plans (and their watch workouts) and rebuild the season from current data. */
export async function rebuildPlan(uid: string, anthropic: Anthropic | null) {
  await syncAthlete(uid, 60);
  const { profile, client, today } = await loadAthlete(uid);
  const future = await loadWeeks(uid, mondayOf(today), "9999");
  const stale = future.flatMap((w) => Object.entries(w.pushedEvents ?? {}).filter(([d]) => d >= today).map(([, id]) => id));
  try {
    await client.deleteEvents(stale);
  } catch (err) {
    logger.warn("Deleting old intervals.icu events failed", { uid, err: String(err) });
  }
  const baseline = await buildAndPlan(uid, profile, today, "rebuild", anthropic);
  await db().collection(`athletes/${uid}/adjustments`).add({
    createdAt: new Date().toISOString(),
    kind: "rebase",
    weekStart: mondayOf(today),
    source: "rules",
    rationale: `Season plan rebuilt from synced data: ${baseline.weeklyKm} km/week, longest recent run ${baseline.longestRunKm} km.`,
  });
  return baseline;
}

async function writeSkeleton(uid: string, skeleton: SkeletonWeek[], opts: { resetPlans: boolean }) {
  await commitInChunks(
    skeleton.map((w) => {
      const data: Partial<WeekPlan> = { ...w };
      if (opts.resetPlans) {
        Object.assign(data, { plannedKm: w.targetKm, plannedVertM: w.targetVertM, sessions: [], source: "none", rationale: "", pushedEvents: {} });
      }
      return [weekRef(uid, w.weekStart), data];
    }),
  );
}

// ---------------------------------------------------------------- sync

export async function syncAthlete(uid: string, days = ROUTINE_SYNC_DAYS) {
  const { profile, client, today } = await loadAthlete(uid);
  // A full re-sync after the effort/analysis logic changes, so history gets the new numbers too.
  if ((profile.effortsVersion ?? 0) < EFFORTS_VERSION) days = Math.max(days, BACKFILL_DAYS);
  const oldest = addDays(today, -days);

  const [rawActivities, rawWellness, existingSnap] = await Promise.all([
    client.listActivities(oldest, today),
    client.listWellness(oldest, today),
    db().collection(`athletes/${uid}/activities`).where("date", ">=", oldest).get(),
  ]);
  const existing = new Map(existingSnap.docs.map((d) => [d.id, d.data() as ActivityDoc]));

  const writes: [DocumentReference, object][] = [];
  let stravaOnly = 0;
  for (const raw of rawActivities) {
    // Activities that reached intervals.icu only via Strava come back without data (Strava's API terms).
    if (raw.source === "STRAVA" && !raw.distance) {
      stravaOnly++;
      continue;
    }
    const a = normalizeActivity(raw);
    const prev = existing.get(a.id);
    let efforts = prev?.bestEfforts ?? {};
    const stale = !prev || prev.effortsVersion !== EFFORTS_VERSION || prev.distanceKm !== a.distanceKm;
    if (stale) {
      efforts = {};
      if (isPlausibleRun({ ...a, bestEfforts: {} })) {
        try {
          const streams = await client.getStreams(a.id, ["time", "distance"]);
          efforts = bestEfforts(streams.time ?? [], streams.distance ?? []);
        } catch (err) {
          logger.warn("Stream fetch failed", { uid, activity: a.id, err: String(err) });
        }
      }
    }
    writes.push([db().doc(`athletes/${uid}/activities/${a.id}`), { ...a, bestEfforts: efforts, effortsVersion: EFFORTS_VERSION }]);
  }
  for (const w of rawWellness) {
    writes.push([db().doc(`athletes/${uid}/wellness/${w.id}`), normalizeWellness(w)]);
  }
  await commitInChunks(writes);

  const athlete = await client.getAthlete();
  const run = athlete.sportSettings?.find((x) => x.types?.includes("Run"));
  const heartRate = heartRateStatus(
    { maxHr: run?.max_hr ?? null, lthr: run?.lthr ?? null, zones: run?.hr_zones ?? null },
    await loadActivities(uid, addDays(today, -90)),
    today,
  );
  await athleteRef(uid).set(
    { lastSyncAt: new Date().toISOString(), stravaOnlyActivities: stravaOnly, effortsVersion: EFFORTS_VERSION, heartRate },
    { merge: true },
  );
  return { activities: rawActivities.length - stravaOnly, wellness: rawWellness.length, stravaOnly };
}

async function loadActivities(uid: string, oldest: string): Promise<ActivityDoc[]> {
  const snap = await db().collection(`athletes/${uid}/activities`).where("date", ">=", oldest).get();
  return snap.docs.map((d) => d.data() as ActivityDoc).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
}

async function loadWellness(uid: string, oldest: string): Promise<WellnessDoc[]> {
  const snap = await db().collection(`athletes/${uid}/wellness`).where("date", ">=", oldest).get();
  return snap.docs.map((d) => d.data() as WellnessDoc).sort((a, b) => a.date.localeCompare(b.date));
}

async function loadWeeks(uid: string, from: string, to: string): Promise<WeekPlan[]> {
  const snap = await db().collection(`athletes/${uid}/weeks`).where("weekStart", ">=", from).where("weekStart", "<=", to).get();
  return snap.docs.map((d) => d.data() as WeekPlan).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export async function recomputeStats(uid: string) {
  const { profile, today } = await loadAthlete(uid);
  const [activities, wellness, weeks] = await Promise.all([
    loadActivities(uid, addDays(today, -400)),
    loadWellness(uid, addDays(today, -180)),
    loadWeeks(uid, profile.planStart ? mondayOf(profile.planStart) : "0000", today),
  ]);
  const stats = buildCompareStats({ displayName: profile.displayName, today, planStart: profile.planStart, activities, wellness, weeks, heartRate: profile.heartRate ?? null });
  await db().doc(`stats/${uid}`).set(stats);
  return stats;
}

// ---------------------------------------------------------------- planning

interface History {
  activities: ActivityDoc[];
  wellness: WellnessDoc[];
  recentWeeklyKm: number[];
  recentLongestKm: number;
  noRecentData: boolean;
}

async function loadHistory(uid: string, profile: AthleteProfile, weekStart: string, today: string): Promise<History> {
  const [activities, wellness, plans] = await Promise.all([
    loadActivities(uid, addDays(weekStart, -42)),
    loadWellness(uid, addDays(weekStart, -60)),
    loadWeeks(uid, addDays(weekStart, -42), addDays(weekStart, -7)),
  ]);
  const currentWeek = mondayOf(today);
  const plannedFor = new Map(plans.filter((w) => w.source !== "none").map((w) => [w.weekStart, w]));
  // Weeks before this one: completed weeks count what was actually run; weeks still
  // ahead (when planning 2-3 weeks out) count what is planned for them.
  const weeks = weeklyTotals(activities, addDays(weekStart, -28), addDays(weekStart, -7)).map((t) => {
    const plan = plannedFor.get(t.weekStart);
    return t.weekStart >= currentWeek && plan ? { ...t, km: Math.max(t.km, plan.plannedKm) } : t;
  });
  const noRecentData = weeks.every((w) => w.km === 0);
  const actualLongest = activities.filter(isRun).reduce((m, a) => Math.max(m, a.distanceKm), 0);
  const plannedLongest = [...plannedFor.values()]
    .filter((w) => w.weekStart >= currentWeek)
    .reduce((m, w) => Math.max(m, ...w.sessions.filter((s) => s.type !== "race").map((s) => s.distanceKm)), 0);
  const recentLongest = Math.max(actualLongest, plannedLongest);
  return {
    activities,
    wellness,
    // A brand-new athlete may have no synced history yet: fall back to their baseline.
    recentWeeklyKm: noRecentData ? [profile.baseline.weeklyKm] : weeks.map((w) => w.km),
    recentLongestKm: recentLongest > 0 ? recentLongest : profile.baseline.longestRunKm,
    noRecentData,
  };
}

function coachContext(profile: AthleteProfile, week: WeekPlan, history: History, guard: GuardContext, extras: { recentWeeks: WeekPlan[]; upcoming: WeekPlan[]; today: string }) {
  const { activities, wellness } = history;
  const totals = weeklyTotals(activities, addDays(week.weekStart, -42), addDays(week.weekStart, -7));
  const planned = new Map(extras.recentWeeks.map((w) => [w.weekStart, w]));
  const cap = growthCapKm(guard.recentWeeklyKm);
  const isEasyWeek = week.isCutback || week.phase === "taper" || week.phase === "race";
  const vo2 = wellness.filter((w) => w.vo2max);

  return {
    today: extras.today,
    athlete: {
      name: profile.displayName,
      notes: profile.notes || null,
      currentLevelFromSyncedData: profile.baseline,
      trainingDays: availabilityOf(profile).trainingDays.map((d) => WEEKDAYS[d]),
      longRunDay: WEEKDAYS[availabilityOf(profile).longRunDay],
    },
    race: { ...RACE, daysToGo: daysBetween(extras.today, RACE.date) },
    weekToPlan: {
      weekStart: week.weekStart,
      planDatesFrom: guard.fromDate > week.weekStart ? guard.fromDate : week.weekStart,
      planDatesTo: addDays(week.weekStart, 6),
      phase: week.phase,
      weeksToRace: week.weeksOut,
      isCutback: week.isCutback,
      basePlan: { targetKm: week.targetKm, targetVertM: week.targetVertM, longRunKm: week.longRunKm },
    },
    limits: {
      targetKmMax: Math.round(Math.min(week.targetKm * LIMITS.maxAboveSkeleton, cap ?? Infinity) * 10) / 10,
      targetKmMin: Math.round(week.targetKm * LIMITS.minOfSkeleton * 10) / 10,
      longestRunMaxKm: Math.round(longRunCapKm(guard.recentLongestKm) * 10) / 10,
      longestRunMaxShareOfWeek: LIMITS.longRunShareMax,
      maxHardSessions: week.phase === "race" ? 0 : isEasyWeek ? LIMITS.maxHardSessionsEasyWeek : LIMITS.maxHardSessions,
      sessionsMustTotalWithinPct: LIMITS.totalTolerance * 100,
      noHardDaysBackToBack: true,
      noHardDayBeforeLongRun: true,
      atLeastOneRestDay: true,
    },
    upcomingBasePlan: extras.upcoming.map((w) => ({ weekStart: w.weekStart, phase: w.phase, targetKm: w.targetKm, targetVertM: w.targetVertM, longRunKm: w.longRunKm, isCutback: w.isCutback })),
    recentWeeks: totals.map((t) => {
      const notYetRun = t.weekStart >= mondayOf(extras.today);
      return {
        weekStart: t.weekStart,
        status: notYetRun ? "planned, not yet run" : "completed",
        plannedKm: planned.get(t.weekStart)?.sessions?.length ? planned.get(t.weekStart)!.sessions.filter((s) => s.type !== "race").reduce((a, s) => a + s.distanceKm, 0) : null,
        actualKm: notYetRun ? null : t.km,
        actualVertM: notYetRun ? null : t.vertM,
        actualDescentM: notYetRun ? null : t.descentM,
        runs: notYetRun ? null : t.runs,
        longestKm: notYetRun ? null : t.longestKm,
      };
    }),
    noRecentDataSynced: history.noRecentData,
    lastWeekPlannedVsDone: (() => {
      const last = planned.get(addDays(week.weekStart, -7));
      if (!last?.sessions?.length || last.weekStart >= mondayOf(extras.today)) return null;
      return last.sessions.map((s) => ({
        date: s.date,
        planned: `${s.title} (${s.type}, ${s.intensity}, ${s.distanceKm} km, ${s.vertM} m)`,
        done: activities.filter((a) => a.date === s.date).map((a) => `${a.type} ${a.distanceKm} km, ${a.elevGainM} m, ${Math.round(a.movingTimeS / 60)} min${a.avgHr ? `, avg HR ${a.avgHr}` : ""}${a.rpe ? `, RPE ${a.rpe}` : ""}`),
      }));
    })(),
    activitiesLast14Days: activities
      .filter((a) => a.date > addDays(extras.today, -14))
      .map((a) => ({
        date: a.date,
        type: a.type,
        name: a.name,
        km: a.distanceKm,
        vertM: a.elevGainM,
        minutes: Math.round(a.movingTimeS / 60),
        paceMinPerKm: a.distanceKm > 0 ? Math.round((a.movingTimeS / 60 / a.distanceKm) * 100) / 100 : null,
        avgHr: isHrClipped(a) ? null : a.avgHr,
        load: a.load,
        rpe: a.rpe,
        descentM: a.descentM,
        feel: a.feel === null ? null : (["strong", "good", "normal", "poor", "weak"][a.feel - 1] ?? null),
        tempC: a.avgTempC,
      })),
    wellnessLast21Days: wellness
      .filter((w) => w.date > addDays(extras.today, -21))
      .map((w) => ({ date: w.date, hrv: w.hrv, restingHR: w.restingHR, sleepH: w.sleepH, sleepScore: w.sleepScore ?? null, vo2max: w.vo2max, fitness: w.ctl, fatigue: w.atl })),
    heartRate: profile.heartRate ?? null,
    trends: {
      easyRunningSharePct28d: profile.heartRate?.reliable === false ? null : easySharePct(activities.filter((a) => a.date > addDays(extras.today, -28))),
      readiness: profile.readiness ?? null,
      vo2maxNow: vo2.at(-1)?.vo2max ?? null,
      vo2max6WeeksAgo: vo2.find((w) => w.date >= addDays(extras.today, -45))?.vo2max ?? null,
    },
  };
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const availabilityOf = (profile: AthleteProfile) => profile.availability ?? DEFAULT_AVAILABILITY;

function guardFor(week: WeekPlan, history: History, fromDate: string, mode: "weekly" | "daily", extra: Partial<GuardContext> = {}): GuardContext {
  return { skeleton: week, recentWeeklyKm: history.recentWeeklyKm, recentLongestKm: history.recentLongestKm, fromDate, mode, ...extra };
}

/** Conservative deterministic week, clamped to what the athlete has actually been doing. */
function templateProposal(week: WeekPlan, guard: GuardContext, availability: Availability): Proposal {
  const cap = growthCapKm(guard.recentWeeklyKm);
  const targetKm = week.phase === "race" ? week.targetKm : Math.floor(Math.min(week.targetKm, cap ?? Infinity));
  const scale = week.targetKm > 0 ? targetKm / week.targetKm : 1;
  return generateTemplateWeek(week, {
    availability,
    fromDate: guard.fromDate,
    targetKm,
    targetVertM: Math.round((week.targetVertM * scale) / 10) * 10,
    longRunKm: Math.min(week.longRunKm, Math.floor(longRunCapKm(guard.recentLongestKm) * 2) / 2),
  });
}

async function maybeRebase(uid: string, profile: AthleteProfile, nextWeekStart: string, history: History): Promise<boolean> {
  const recentPlans = await loadWeeks(uid, addDays(nextWeekStart, -21), addDays(nextWeekStart, -7));
  const totals = new Map(weeklyTotals(history.activities, addDays(nextWeekStart, -21), addDays(nextWeekStart, -7)).map((t) => [t.weekStart, t.km]));
  const recent = recentPlans
    .filter((w) => w.source !== "none" && w.weekStart >= mondayOf(profile.planStart))
    .map((w) => ({ targetKm: w.plannedKm, actualKm: totals.get(w.weekStart) ?? 0 }));
  if (!shouldRebase(recent)) return false;

  const actual = recent.map((r) => r.actualKm);
  const baseline: Baseline = {
    weeklyKm: Math.max(10, actual.reduce((a, b) => a + b, 0) / actual.length),
    longestRunKm: history.recentLongestKm,
  };
  await writeSkeleton(uid, buildSkeleton({ startDate: nextWeekStart, baseline }), { resetPlans: false });
  await db().collection(`athletes/${uid}/adjustments`).add({
    createdAt: new Date().toISOString(),
    kind: "rebase",
    weekStart: nextWeekStart,
    source: "rules",
    rationale: `The last two weeks came in well under plan (${actual.map((k) => `${k} km`).join(", ")}). The remaining plan was rebuilt from your current level (${Math.round(baseline.weeklyKm)} km/week) so it ramps up safely instead of jumping back to old targets.`,
  });
  logger.info("Rebased skeleton", { uid, nextWeekStart, baseline });
  return true;
}

/** How many weeks ahead are always planned (the first is firm, the rest are drafts re-planned weekly). */
export const WEEKS_AHEAD = 3;

/** Plan `WEEKS_AHEAD` consecutive weeks starting at `firstWeek`, each building on the one before. */
export async function planAhead(uid: string, firstWeek: string, kind: "initial" | "weekly" | "manual", anthropic: Anthropic | null) {
  for (let i = 0; i < WEEKS_AHEAD; i++) {
    const weekStart = addDays(firstWeek, 7 * i);
    if (!(await weekRef(uid, weekStart).get()).exists) break; // past race week
    await planWeek(uid, weekStart, { kind, checkRebase: kind === "weekly" && i === 0 }, anthropic);
  }
}

export async function planWeek(
  uid: string,
  weekStart: string,
  opts: { fromDate?: string; kind: "initial" | "weekly" | "manual"; checkRebase?: boolean },
  anthropic: Anthropic | null,
) {
  const { profile, client, today } = await loadAthlete(uid);
  const fromDate = opts.fromDate && opts.fromDate > weekStart ? opts.fromDate : weekStart;

  let history = await loadHistory(uid, profile, weekStart, today);
  if (opts.checkRebase && (await maybeRebase(uid, profile, weekStart, history))) {
    history = await loadHistory(uid, profile, weekStart, today);
  }

  const snap = await weekRef(uid, weekStart).get();
  if (!snap.exists) throw new Error(`No plan week ${weekStart} for ${uid}`);
  const week = snap.data() as WeekPlan;
  const guard = guardFor(week, history, fromDate, "weekly", { availability: availabilityOf(profile) });

  const [recentWeeks, upcoming] = await Promise.all([
    loadWeeks(uid, addDays(weekStart, -42), addDays(weekStart, -7)),
    loadWeeks(uid, addDays(weekStart, 7), addDays(weekStart, 21)),
  ]);

  let proposal: Proposal | null = null;
  let rejected: string[][] = [];
  let model: string | null = null;
  if (anthropic) {
    try {
      const result = await proposePlan(
        anthropic,
        {
          task: `Plan the sessions for ${fromDate} to ${addDays(weekStart, 6)} for ${profile.displayName}. Use the base plan targets as the starting point and adjust them to the data within the limits.`,
          context: coachContext(profile, week, history, guard, { recentWeeks, upcoming, today }),
        },
        guard,
      );
      ({ proposal, rejected, model } = result);
    } catch (err) {
      logger.error("Coach call failed; using template", { uid, weekStart, err: String(err) });
      rejected.push([`Coach unavailable: ${String(err)}`]);
    }
  }

  const source: WeekPlan["source"] = proposal ? "claude" : "template";
  if (!proposal) {
    proposal = templateProposal(week, guard, availabilityOf(profile));
    const templateErrors = validateProposal(proposal, guard);
    if (templateErrors.length) logger.warn("Template week outside guardrails", { uid, weekStart, templateErrors });
  }

  await savePlan(uid, client, week, proposal, fromDate, source);
  await db().collection(`athletes/${uid}/adjustments`).add({
    createdAt: new Date().toISOString(),
    kind: opts.kind,
    weekStart,
    fromDate,
    source,
    model,
    rationale: proposal.rationale,
    basePlanKm: week.targetKm,
    plannedKm: proposal.targetKm,
    rejectedAttempts: rejected.map((errors) => ({ errors })),
  });
  return { source, proposal };
}

async function savePlan(uid: string, client: IntervalsClient, week: WeekPlan, proposal: Proposal, fromDate: string, source: WeekPlan["source"]) {
  // Without trustworthy heart rate, zone targets would be wrong on the watch: use effort words instead.
  const profile = (await athleteRef(uid).get()).data() as AthleteProfile | undefined;
  if (profile?.heartRate?.reliable === false) {
    proposal = { ...proposal, sessions: proposal.sessions.map((s) => ({ ...s, description: toEffortTargets(s.description) })) };
  }
  const kept = (week.sessions ?? []).filter((s) => s.date < fromDate);
  const sessions = [...kept, ...proposal.sessions].sort((a, b) => a.date.localeCompare(b.date));
  const pushedEvents = await pushSessions(client, week.pushedEvents ?? {}, proposal.sessions, fromDate);
  await weekRef(uid, week.weekStart).set(
    {
      plannedKm: proposal.targetKm,
      plannedVertM: proposal.targetVertM,
      sessions,
      source,
      rationale: proposal.rationale,
      pushedEvents,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function pushSessions(client: IntervalsClient, previous: Record<string, number>, sessions: Session[], fromDate: string) {
  const pushed = { ...previous };
  const stale = Object.entries(pushed).filter(([date]) => date >= fromDate);
  try {
    await client.deleteEvents(stale.map(([, id]) => id));
  } catch (err) {
    logger.warn("Deleting old intervals.icu events failed", { err: String(err) });
  }
  for (const [date] of stale) delete pushed[date];

  const events = sessions.filter((s) => s.date >= fromDate).map(sessionToEvent).filter((e) => e !== null);
  if (events.length) {
    const created = await client.createEvents(events);
    created.forEach((e, i) => {
      pushed[events[i].start_date_local.slice(0, 10)] = e.id;
    });
  }
  return pushed;
}

// ---------------------------------------------------------------- morning check

export async function morningCheck(uid: string, anthropic: Anthropic | null) {
  await syncAthlete(uid, 3);
  const { profile, client, today } = await loadAthlete(uid);
  const wellness = await loadWellness(uid, addDays(today, -61));
  const readiness = computeReadiness(today, wellness);
  await athleteRef(uid).set({ readiness }, { merge: true });

  const weekStart = mondayOf(today);
  const snap = await weekRef(uid, weekStart).get();
  if (!snap.exists) return { readiness, changed: false };
  const week = snap.data() as WeekPlan;
  if (week.source === "none" || !week.sessions?.length) {
    await planWeek(uid, weekStart, { fromDate: today, kind: "weekly" }, anthropic);
    return { readiness, changed: true };
  }

  const remaining = week.sessions.filter((s) => s.date >= today);
  const todaySession = remaining.find((s) => s.date === today);
  const tomorrowSession = remaining.find((s) => s.date === addDays(today, 1));
  const needsChange =
    (readiness.level === "red" && ((todaySession && todaySession.type !== "rest" && todaySession.type !== "race") || tomorrowSession?.intensity === "hard")) ||
    (readiness.level === "amber" && (todaySession?.intensity === "hard" || tomorrowSession?.intensity === "hard"));
  if (!needsChange || remaining.length === 0) return { readiness, changed: false };

  const history = await loadHistory(uid, profile, weekStart, today);
  const guard = guardFor(week, history, today, "daily", { original: remaining, readiness: readiness.level, availability: availabilityOf(profile) });
  // Daily changes keep the week's target; they may only reduce or reshuffle.
  const target = { targetKm: week.plannedKm, targetVertM: week.plannedVertM };

  let proposal: Proposal | null = null;
  let rejected: string[][] = [];
  let model: string | null = null;
  if (anthropic) {
    try {
      ({ proposal, rejected, model } = await proposePlan(
        anthropic,
        {
          task:
            `Morning check for ${profile.displayName}: readiness is ${readiness.level.toUpperCase()} (${readiness.reasons.join(" ")}). ` +
            `Re-plan the remaining days ${today} to ${addDays(weekStart, 6)}. You may only reduce or move load, never add it: keep targetKm ${target.targetKm} and targetVertM ${target.targetVertM}, ` +
            `remaining total distance must not exceed the current remaining plan, and do not add hard sessions.` +
            (readiness.level === "red" ? " Today must be rest or easy." : ""),
          context: {
            ...coachContext(profile, week, history, guard, { recentWeeks: [], upcoming: [], today }),
            currentRemainingPlan: remaining,
            readiness,
          },
        },
        guard,
      ));
    } catch (err) {
      logger.error("Coach call failed in morning check", { uid, err: String(err) });
    }
  }

  const source: WeekPlan["source"] = proposal ? "claude" : "template";
  if (!proposal) {
    const sessions = downgradeForReadiness(remaining, today, readiness.level);
    proposal = {
      ...target,
      sessions,
      rationale: `Recovery check is ${readiness.level}: ${readiness.reasons.join(" ")} Today's session was softened; the rest of the week is unchanged.`,
    };
  }

  await savePlan(uid, client, week, { ...proposal, ...target }, today, source === "claude" ? "claude" : week.source);
  await db().collection(`athletes/${uid}/adjustments`).add({
    createdAt: new Date().toISOString(),
    kind: "daily",
    weekStart,
    fromDate: today,
    source,
    model,
    readiness: readiness.level,
    rationale: proposal.rationale,
    rejectedAttempts: rejected.map((errors) => ({ errors })),
  });
  return { readiness, changed: true };
}
