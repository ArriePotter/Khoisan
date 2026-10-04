import { describe, expect, it } from "vitest";
import { RACE } from "../config";
import { addDays, mondayOf } from "../dates";
import type { Proposal, Session, WellnessDoc } from "../types";
import { downgradeForReadiness, shouldRebase } from "./adjust";
import { bestEfforts, fastestSegmentS } from "./bestEfforts";
import { efficiency, isPlausibleRun, strongestAndWeakest } from "./analysis";
import type { ActivityDoc } from "../types";
import { easySharePct, heartRateStatus, isHrClipped, toEffortTargets } from "./heartRate";
import { growthCapKm, longRunCapKm, validateProposal, type GuardContext } from "./guardrails";
import { computeReadiness } from "./readiness";
import { buildSkeleton, MAX_WEEKLY_GROWTH } from "./skeleton";
import { generateTemplateWeek, type Availability } from "./templates";
import { dayIndex } from "../dates";

const START = "2026-10-05";
const BASELINES = [
  { weeklyKm: 20, longestRunKm: 10 },
  { weeklyKm: 40, longestRunKm: 18, weeklyVertM: 600 },
  { weeklyKm: 65, longestRunKm: 30, weeklyVertM: 2000 },
];

describe("skeleton", () => {
  const weeks = buildSkeleton({ startDate: START, baseline: BASELINES[1] });

  it("runs from this week to race week", () => {
    expect(weeks[0].weekStart).toBe(START);
    expect(weeks.at(-1)!.weekStart).toBe(mondayOf(RACE.date));
    expect(weeks.at(-1)!.phase).toBe("race");
    expect(weeks.length).toBe(34);
  });

  it("has phases in order: base, build, peak, taper, race", () => {
    const order = ["base", "build", "peak", "taper", "race"];
    const idx = weeks.map((w) => order.indexOf(w.phase));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(weeks.filter((w) => w.phase === "peak")).toHaveLength(4);
    expect(weeks.filter((w) => w.phase === "taper")).toHaveLength(2);
  });

  it.each(BASELINES)("never grows weekly km more than 8%% between loading weeks (%o)", (baseline) => {
    const ws = buildSkeleton({ startDate: START, baseline });
    const loading = ws.filter((w) => (w.phase === "base" || w.phase === "build" || w.weeksOut === 6) && !w.isCutback);
    for (let i = 1; i < loading.length; i++) {
      expect(loading[i].targetKm).toBeLessThanOrEqual(Math.ceil(loading[i - 1].targetKm * MAX_WEEKLY_GROWTH) + 1);
    }
  });

  it.each(BASELINES)("peaks at ~70 km/week, never a single run of 60 km or more (%o)", (baseline) => {
    const ws = buildSkeleton({ startDate: START, baseline });
    expect(Math.max(...ws.map((w) => w.targetKm))).toBeGreaterThanOrEqual(65);
    expect(Math.max(...ws.map((w) => w.targetKm))).toBeLessThanOrEqual(75);
    expect(Math.max(...ws.filter((w) => w.phase !== "race").map((w) => w.longRunKm))).toBeLessThan(60);
  });

  it("peaks with a ~36 km race simulation and a ~2 week taper", () => {
    const peakLong = Math.max(...weeks.filter((w) => w.phase === "peak").map((w) => w.longRunKm));
    expect(peakLong).toBeGreaterThanOrEqual(32);
    expect(peakLong).toBeLessThanOrEqual(36);
    expect(weeks.find((w) => w.weeksOut === 4)!.longRunKm).toBe(peakLong);
    const peakVert = Math.max(...weeks.map((w) => w.targetVertM));
    expect(peakVert).toBeGreaterThanOrEqual(1500); // >= 50% of race climbing
    expect(peakVert).toBeLessThanOrEqual(2300); // <= ~75%
    const [t2w, t1w] = weeks.slice(-3);
    const peakKm = Math.max(...weeks.map((w) => w.targetKm));
    expect(t2w.targetKm).toBeLessThanOrEqual(peakKm * 0.6 + 1); // >= 40% cut
    expect(t1w.targetKm).toBeLessThanOrEqual(peakKm * 0.4 + 1);
    const [t2, t1, race] = weeks.slice(-3);
    expect(t2.targetKm).toBeGreaterThan(t1.targetKm);
    expect(t1.targetKm).toBeGreaterThan(race.targetKm);
  });

  it("schedules a cutback every fourth week in base/build", () => {
    const cutbacks = weeks.filter((w) => w.isCutback);
    expect(cutbacks.length).toBeGreaterThanOrEqual(6);
    for (const c of cutbacks) expect(c.targetKm).toBeLessThan(weeks[c.index - 1].targetKm);
  });
});

describe("template weeks always pass the guardrails", () => {
  it.each(BASELINES)("baseline %o", (baseline) => {
    const ws = buildSkeleton({ startDate: START, baseline });
    for (let i = 0; i < ws.length; i++) {
      const week = ws[i];
      const proposal = generateTemplateWeek(week);
      // Assume the athlete completed the previous weeks as planned.
      const recent = ws.slice(Math.max(0, i - 4), i).map((w) => w.targetKm);
      const longest = Math.max(baseline.longestRunKm, ...ws.slice(Math.max(0, i - 6), i).map((w) => (w.phase === "race" ? 0 : w.longRunKm)));
      const errors = validateProposal(proposal, {
        skeleton: week,
        recentWeeklyKm: recent.length ? recent : [baseline.weeklyKm],
        recentLongestKm: longest,
        fromDate: week.weekStart,
        mode: "weekly",
      });
      expect({ week: week.weekStart, phase: week.phase, errors }).toEqual({ week: week.weekStart, phase: week.phase, errors: [] });
    }
  });

  it("supports mid-week starts", () => {
    const ws = buildSkeleton({ startDate: "2026-10-08", baseline: BASELINES[1] });
    const p = generateTemplateWeek(ws[0], { fromDate: "2026-10-08" });
    expect(p.sessions.map((s) => s.date)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });

  it("keeps several short runs when volume is clamped low (restart weeks)", () => {
    const ws = buildSkeleton({ startDate: START, baseline: { weeklyKm: 20, longestRunKm: 21 } });
    const p = generateTemplateWeek(ws[1], { targetKm: 12, longRunKm: 10.5 });
    const runs = p.sessions.filter((s) => s.distanceKm > 0);
    expect(runs.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...runs.map((s) => s.distanceKm))).toBeLessThanOrEqual(6);
    expect(validateProposal(p, { skeleton: ws[1], recentWeeklyKm: [0, 0, 10.2, 8.5], recentLongestKm: 10.2, fromDate: ws[1].weekStart, mode: "weekly" })).toEqual([]);
  });

  it("race week contains the race on race day", () => {
    const ws = buildSkeleton({ startDate: START, baseline: BASELINES[1] });
    const race = generateTemplateWeek(ws.at(-1)!).sessions.find((s) => s.type === "race");
    expect(race?.date).toBe(RACE.date);
    expect(race?.distanceKm).toBe(RACE.distanceKm);
  });
});

const SCHEDULES: Availability[] = [
  { trainingDays: [1, 3, 6], longRunDay: 6 }, // Tue, Thu, Sun
  { trainingDays: [0, 2, 4, 5], longRunDay: 5 }, // Mon, Wed, Fri, Sat
  { trainingDays: [1, 2, 3, 5, 6], longRunDay: 5 }, // long Saturday, Sunday back-to-back
  { trainingDays: [0, 1, 2, 3, 4, 5], longRunDay: 5 }, // six days
];

describe("training days and long-run day", () => {
  it.each(SCHEDULES)("every week fits the schedule and passes the guardrails (%o)", (availability) => {
    for (const baseline of BASELINES) {
      const ws = buildSkeleton({ startDate: START, baseline });
      ws.forEach((week, i) => {
        const p = generateTemplateWeek(week, { availability });
        const recent = ws.slice(Math.max(0, i - 4), i).map((w) => w.targetKm);
        const longest = Math.max(baseline.longestRunKm, ...ws.slice(Math.max(0, i - 6), i).map((w) => (w.phase === "race" ? 0 : w.longRunKm)));
        const errors = validateProposal(p, {
          skeleton: week,
          recentWeeklyKm: recent.length ? recent : [baseline.weeklyKm],
          recentLongestKm: longest,
          fromDate: week.weekStart,
          mode: "weekly",
          availability,
        });
        expect({ week: week.weekStart, errors }).toEqual({ week: week.weekStart, errors: [] });
        if (week.phase !== "race") {
          const runs = p.sessions.filter((s) => s.distanceKm > 0);
          for (const r of runs) expect(availability.trainingDays).toContain(dayIndex(r.date));
          const long = runs.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
          expect(dayIndex(long.date)).toBe(availability.longRunDay);
        }
      });
    }
  });

  it("schedules a back-to-back the day after the long run in peak weeks", () => {
    const ws = buildSkeleton({ startDate: START, baseline: BASELINES[1] });
    const peak = ws.find((w) => w.weeksOut === 5)!;
    const p = generateTemplateWeek(peak, { availability: SCHEDULES[2] });
    const sun = p.sessions.find((s) => dayIndex(s.date) === 6)!;
    expect(sun.title).toMatch(/Back-to-back/);
  });

  it("rejects runs on days the athlete cannot train", () => {
    const ws = buildSkeleton({ startDate: START, baseline: BASELINES[1] });
    const week = ws[10];
    const availability = SCHEDULES[0];
    const p = generateTemplateWeek(week, { availability });
    const moved = { ...p, sessions: p.sessions.map((s) => (dayIndex(s.date) === 0 ? { ...s, type: "easy" as const, intensity: "easy" as const, distanceKm: 5 } : s)) };
    const errs = validateProposal(moved, { skeleton: week, recentWeeklyKm: [40, 40], recentLongestKm: 20, fromDate: week.weekStart, mode: "weekly", availability });
    expect(errs.join()).toMatch(/Monday, which is not a training day/);
  });
});

describe("guardrails reject unsafe plans", () => {
  const ws = buildSkeleton({ startDate: START, baseline: BASELINES[1] });
  const week = ws[10];
  const ctx: GuardContext = { skeleton: week, recentWeeklyKm: [ws[7].targetKm, ws[8].targetKm, ws[9].targetKm], recentLongestKm: 22, fromDate: week.weekStart, mode: "weekly" };
  const good = generateTemplateWeek(week);
  const withSessions = (fn: (s: Session[]) => Session[], extra: Partial<Proposal> = {}): Proposal => ({ ...good, ...extra, sessions: fn(good.sessions.map((s) => ({ ...s }))) });

  it("accepts the template", () => {
    expect(validateProposal(good, ctx)).toEqual([]);
  });

  it("rejects volume jumps", () => {
    const errs = validateProposal({ ...good, targetKm: week.targetKm * 1.3 }, ctx);
    expect(errs.join()).toMatch(/exceeds the plan/);
  });

  it("rejects growth beyond what was actually run", () => {
    const errs = validateProposal(good, { ...ctx, recentWeeklyKm: [10, 12, 8] });
    expect(errs.join()).toMatch(/grows too fast/);
  });

  it("rejects an oversized long run", () => {
    const errs = validateProposal(withSessions((s) => s.map((x) => (x.type === "long" ? { ...x, distanceKm: 35 } : x))), ctx);
    expect(errs.join()).toMatch(/safe cap/);
  });

  it("rejects back-to-back hard days and too many hard sessions", () => {
    const errs = validateProposal(
      withSessions((s) => s.map((x, i) => (i >= 1 && i <= 3 ? { ...x, type: "intervals", intensity: "hard" } : x))),
      ctx,
    );
    expect(errs.join()).toMatch(/consecutive/);
    expect(errs.join()).toMatch(/hard sessions; at most 2/);
  });

  it("rejects wordy sessions (real example from a Claude plan)", () => {
    const wordy = withSessions((s) =>
      s.map((x, i) =>
        i === 2
          ? {
              ...x,
              description:
                "Warmup\n- 10m Z1 HR walk-jog\nMain set\n- 22m Z2 HR\nCooldown\n- 6m Z1 HR\nPick smooth, gently rolling trail and walk any steep bits. Keep it conversational.",
              note: "Afterwards do 5 minutes of ankle mobility and single-leg balance work to protect the old ligament injury.",
            }
          : x,
      ),
    );
    const errs = validateProposal(wordy, ctx).join();
    expect(errs).toMatch(/only workout steps/);
    expect(errs).toMatch(/one short line/);
  });

  it("strength sessions list exercises, not heart-rate steps (real example)", () => {
    const restIdx = good.sessions.findIndex((x) => x.type === "rest");
    const as = (description: string) =>
      withSessions((s) => s.map((x, i) => (i === restIdx ? { ...x, type: "strength" as const, intensity: "easy" as const, title: "Ankle and leg strength", durationMin: 25, description } : x)));
    expect(validateProposal(as("- 5m Z1 HR\n- 20m Z1 HR"), ctx).join()).toMatch(/list exercises from the library/);
    // Real example of a wordy session that must be rejected.
    expect(
      validateProposal(as("Warmup\nMain set\nDo 3 rounds: 15 single-leg calf raises each side, 30s single-leg balance each side"), ctx).join(),
    ).toMatch(/not valid: "Warmup"/);
    expect(validateProposal(as("calf-raise 3x15 each\nsingle-leg-balance 3x30s each\nsplit-squat 3x10 each\nglute-bridge 3x10 each\nside-plank 3x30s each"), ctx)).toEqual([]);
    expect(validateProposal(as("burpees 3x10"), ctx).join()).toMatch(/not valid: "burpees 3x10"/);
  });

  it("rejects a week without rest", () => {
    const errs = validateProposal(withSessions((s) => s.map((x) => (x.type === "rest" ? { ...x, type: "easy", intensity: "easy", distanceKm: 1 } : x))), ctx);
    expect(errs.join()).toMatch(/rest day/);
  });

  it("rejects missing days", () => {
    const errs = validateProposal(withSessions((s) => s.slice(1)), ctx);
    expect(errs.join()).toMatch(/Expected exactly 7/);
  });

  it("daily mode forbids adding load", () => {
    const daily: GuardContext = { ...ctx, mode: "daily", fromDate: addDays(week.weekStart, 3), original: good.sessions.slice(3), readiness: "red" };
    const p = withSessions((s) => s.slice(3).map((x, i) => (i === 0 ? { ...x, distanceKm: x.distanceKm + 10, intensity: "hard", type: "intervals" } : x)));
    const errs = validateProposal(p, daily);
    expect(errs.join()).toMatch(/raises remaining volume/);
    expect(errs.join()).toMatch(/today must be rest or easy/);
  });

  it("never allows a single run anywhere near 60 km", () => {
    expect(longRunCapKm(100)).toBeLessThan(60);
  });

  it("caps", () => {
    expect(growthCapKm([])).toBeNull();
    expect(growthCapKm([40, 40, 50])).toBeCloseTo(50 * 1.12 + 3);
    expect(longRunCapKm(20)).toBeCloseTo(26);
    expect(longRunCapKm(60)).toBe(42);
  });
});

function wellnessSeries(days: number, today: string, f: (i: number) => Partial<WellnessDoc>): WellnessDoc[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, hrv: 60, restingHR: 50, sleepH: 7.5, sleepScore: 80, vo2max: 52, ctl: 50, atl: 55, readiness: null, ...f(i - days + 1) };
  });
}

describe("readiness", () => {
  const today = "2026-11-10";
  it("is green on normal data", () => {
    expect(computeReadiness(today, wellnessSeries(40, today, (i) => ({ hrv: 60 + (i % 3) }))).level).toBe("green");
  });
  it("is red when HRV crashes and stays low", () => {
    const r = computeReadiness(today, wellnessSeries(40, today, (i) => ({ hrv: i > -5 ? 38 : 60 + (i % 3) })));
    expect(r.level).toBe("red");
  });
  it("is amber on elevated resting HR", () => {
    const r = computeReadiness(today, wellnessSeries(40, today, (i) => ({ restingHR: i === 0 ? 56 : 50 + (i % 2), hrv: 60 + (i % 3) })));
    expect(r.level).toBe("amber");
  });
  it("flags a poor sleep score", () => {
    const r = computeReadiness(today, wellnessSeries(40, today, (i) => ({ hrv: 60 + (i % 3), sleepScore: i === 0 ? 38 : 80 })));
    expect(r.level).toBe("amber");
    expect(r.reasons.join()).toMatch(/Poor sleep \(score 38/);
  });

  it("reads last night's sleep from yesterday's row when Garmin files it by the night's start date (real example)", () => {
    // 4 Oct row has HRV but no sleep; the 6.1 h / score 38 night is filed under 3 Oct.
    const rows = wellnessSeries(40, today, (i) => ({ hrv: 60 + (i % 3), sleepH: i === 0 ? null : i === -1 ? 6.1 : 8, sleepScore: i === 0 ? null : i === -1 ? 38 : 85 }));
    const r = computeReadiness(today, rows);
    expect(r.metrics.sleepH).toBe(6.1);
    expect(r.reasons.join()).toMatch(/Poor sleep \(score 38/);
  });

  it("is unknown without data", () => {
    expect(computeReadiness(today, []).level).toBe("unknown");
  });
});

describe("best efforts", () => {
  it("finds the fastest 5 km window", () => {
    // 10 km at 5:00/km with a 4:00/km stretch from 3-8 km
    const time: number[] = [];
    const dist: number[] = [];
    let t = 0;
    for (let d = 0; d <= 10000; d += 10) {
      dist.push(d);
      time.push(t);
      t += d >= 3000 && d < 8000 ? 2.4 : 3;
    }
    expect(fastestSegmentS(time, dist, 5000)).toBe(1200);
    expect(fastestSegmentS(time, dist, 10000)).toBe(2700);
    expect(fastestSegmentS(time, dist, 21100)).toBeNull();
  });

  it("finds 1K, 1 mile, 2 miles and 5K inside a 10K", () => {
    // 10 km at 5:00/km with one fast kilometre (3:45) between 6 and 7 km.
    const time: number[] = [];
    const dist: number[] = [];
    let t = 0;
    for (let d = 0; d <= 10000; d += 10) {
      dist.push(d);
      time.push(t);
      t += d >= 6000 && d < 7000 ? 2.25 : 3;
    }
    const e = bestEfforts(time, dist);
    expect(e["1k"]).toBe(225);
    expect(e["1mi"]).toBe(225 + Math.round(609.344 * 0.3));
    expect(e["5k"]).toBe(1425);
    expect(e["10k"]).toBe(2925);
  });

  it("ignores physically impossible efforts (GPS glitches)", () => {
    const time = [0, 60, 120];
    const dist = [0, 1000, 2000]; // 1:00/km
    expect(bestEfforts(time, dist)).toEqual({});
  });
});

describe("adjustments", () => {
  const ws = buildSkeleton({ startDate: START, baseline: BASELINES[1] });
  const week = ws.find((w) => w.phase === "build" && !w.isCutback)!;
  const sessions = generateTemplateWeek(week).sessions;
  const hardDay = sessions.find((s) => s.intensity === "hard")!;

  it("downgrades a hard day on amber and never adds load", () => {
    const out = downgradeForReadiness(sessions, hardDay.date, "amber");
    const today = out.find((s) => s.date === hardDay.date)!;
    expect(today.intensity).toBe("easy");
    const sum = (xs: Session[]) => xs.reduce((a, s) => a + s.distanceKm, 0);
    expect(sum(out)).toBeLessThanOrEqual(sum(sessions));
  });

  it("turns a hard day into rest on red", () => {
    const out = downgradeForReadiness(sessions, hardDay.date, "red");
    expect(out.find((s) => s.date === hardDay.date)!.type).toBe("rest");
  });

  it("rebases only after two weak weeks", () => {
    expect(shouldRebase([{ targetKm: 50, actualKm: 20 }])).toBe(false);
    expect(shouldRebase([{ targetKm: 50, actualKm: 45 }, { targetKm: 50, actualKm: 20 }])).toBe(false);
    expect(shouldRebase([{ targetKm: 50, actualKm: 25 }, { targetKm: 55, actualKm: 20 }])).toBe(true);
  });
});

describe("run analytics", () => {
  const run = (o: Partial<ActivityDoc>): ActivityDoc => ({
    id: o.date ?? "x", date: "2026-09-01", startLocal: "", type: "TrailRun", name: "", distanceKm: 8, movingTimeS: 3600,
    elevGainM: 100, avgHr: 140, maxHr: 165, load: null, rpe: null, gapSpeed: 2.5, bestEfforts: {},
    hrZoneTimes: null, descentM: 100, feel: null, avgTempC: null, ...o,
  });

  it("detects heart rate capped at the max-HR setting (real example: avg 139, max 140)", () => {
    expect(isHrClipped(run({ avgHr: 139, maxHr: 140, movingTimeS: 4138 }))).toBe(true);
    expect(isHrClipped(run({ avgHr: 145, maxHr: 168 }))).toBe(false);
    const clippedRuns = ["2026-09-24", "2026-09-10", "2026-08-25", "2026-08-10"].map((date) => run({ date, avgHr: 138, maxHr: 140 }));
    const status = heartRateStatus({ maxHr: 140, lthr: 127, zones: [106, 113, 119, 126, 129, 133, 140] }, clippedRuns, "2026-10-04");
    expect(status.reliable).toBe(false);
    expect(status.issue).toMatch(/capped at 140 bpm in 4 of your last 4 runs/);
    const raised = heartRateStatus({ maxHr: 180, lthr: 160, zones: null }, clippedRuns, "2026-10-04");
    expect(raised.issue).toMatch(/Max HR is now 180, but 4 of your last 4 runs were recorded capped at 140/);
    // Three clean new runs after the fix clear it.
    const fresh = ["2026-10-01", "2026-10-02", "2026-10-03"].map((date) => run({ date, avgHr: 150, maxHr: 172 }));
    expect(heartRateStatus({ maxHr: 180, lthr: 160, zones: null }, [...clippedRuns, ...fresh], "2026-10-04").reliable).toBe(true);
    expect(efficiency(clippedRuns[0])).toBeNull();
  });

  it("flags a threshold HR that is implausibly low for the max (real example: LTHR 127, max 180)", () => {
    const fine = ["2026-09-24", "2026-09-10", "2026-08-25"].map((date) => run({ date, avgHr: 150, maxHr: 170 }));
    const status = heartRateStatus({ maxHr: 180, lthr: 127, zones: [106, 113, 119, 126, 129, 133, 180] }, fine, "2026-10-04");
    expect(status.reliable).toBe(false);
    expect(status.issue).toMatch(/Threshold HR \(127\) looks too low/);
    expect(heartRateStatus({ maxHr: 180, lthr: 160, zones: null }, fine, "2026-10-04").reliable).toBe(true);
  });

  it("computes the easy-running share from zone times, ignoring capped runs", () => {
    const easy = run({ hrZoneTimes: [1200, 1800, 300, 200, 100, 0, 0] }); // 3000 of 3600 s easy
    const capped = run({ avgHr: 139, maxHr: 140, hrZoneTimes: [0, 0, 0, 0, 0, 0, 3600] });
    expect(easySharePct([easy, capped])).toBe(83);
  });

  it("swaps heart-rate targets for effort words", () => {
    expect(toEffortTargets("- 15m Z2 HR\n\n6x\n- 3m Z4 HR\n- 2m Z1 HR\n\n- 10m Z1-Z2 HR")).toBe("- 15m easy\n\n6x\n- 3m hard\n- 2m very easy\n\n- 10m easy");
  });

  it("filters out a drive saved as a run", () => {
    // Real example: 3.1 km at 3:10/km with an average heart rate of 69.
    expect(isPlausibleRun(run({ distanceKm: 3.1, movingTimeS: 588, avgHr: 69 }))).toBe(false);
    expect(isPlausibleRun(run({}))).toBe(true);
  });

  it("scores efficiency as grade-adjusted metres per heartbeat", () => {
    expect(efficiency(run({ gapSpeed: 2.5, avgHr: 150 }))).toBeCloseTo(1.0);
    expect(efficiency(run({ avgHr: null }))).toBeNull();
  });

  it("picks the strongest and weakest run relative to the athlete's typical run", () => {
    const runs = [
      run({ date: "2026-09-01", gapSpeed: 2.5, avgHr: 150 }),
      run({ date: "2026-09-08", gapSpeed: 2.75, avgHr: 150, name: "Good day" }),
      run({ date: "2026-09-15", gapSpeed: 2.25, avgHr: 150, name: "Heavy legs" }),
      run({ date: "2026-09-20", gapSpeed: 2.5, avgHr: 150 }),
    ];
    const r = strongestAndWeakest(runs, "2026-10-01")!;
    expect(r.strongest.name).toBe("Good day");
    expect(r.strongest.vsTypicalPct).toBe(10);
    expect(r.weakest.name).toBe("Heavy legs");
    expect(r.weakest.vsTypicalPct).toBe(-10);
    expect(strongestAndWeakest(runs.slice(0, 2), "2026-10-01")).toBeNull();
  });
});
