import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays } from "../dates";

// ---- In-memory Firestore (just the surface service.ts uses) ----------------
const store = new Map<string, Record<string, unknown>>();
let autoId = 0;

function docRef(path: string) {
  return {
    id: path.split("/").pop()!,
    path,
    async get() {
      const data = store.get(path);
      return { exists: !!data, id: path.split("/").pop(), data: () => data, get: (k: string) => data?.[k] };
    },
    async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
      store.set(path, opts?.merge ? { ...(store.get(path) ?? {}), ...data } : { ...data });
    },
  };
}

type Filter = { field: string; op: string; value: string };
function query(path: string, filters: Filter[] = []) {
  return {
    where: (field: string, op: string, value: string) => query(path, [...filters, { field, op, value }]),
    select: () => query(path, filters),
    async get() {
      const docs = [...store.entries()]
        .filter(([k]) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/"))
        .filter(([, v]) => filters.every((f) => (f.op === ">=" ? String(v[f.field]) >= f.value : String(v[f.field]) <= f.value)))
        .map(([k, v]) => ({ id: k.split("/").pop(), data: () => v }));
      return { docs };
    },
    async add(data: Record<string, unknown>) {
      store.set(`${path}/auto${++autoId}`, data);
    },
  };
}

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    doc: docRef,
    collection: (p: string) => query(p),
    batch: () => {
      const ops: [ReturnType<typeof docRef>, Record<string, unknown>, { merge?: boolean }][] = [];
      return {
        set: (ref: ReturnType<typeof docRef>, data: Record<string, unknown>, opts: { merge?: boolean }) => ops.push([ref, data, opts]),
        commit: async () => {
          for (const [ref, data, opts] of ops) await ref.set(data, opts);
        },
      };
    },
  }),
}));
vi.mock("firebase-functions", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// ---- Fake intervals.icu ----------------------------------------------------
const TODAY = "2026-10-07"; // Wednesday
const calls: { method: string; url: string; body?: unknown }[] = [];
let crashHrv = false;
let eventId = 1000;

function fakeIntervals(url: string, init?: RequestInit): Response {
  const u = new URL(url);
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url: u.pathname, body });
  const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });

  if (u.pathname === "/api/v1/athlete/i42") return json({ id: "i42", sportSettings: [{ types: ["Run", "TrailRun"], max_hr: 190, lthr: 168, hr_zones: [140, 155, 165, 172, 178, 184, 190] }] });
  if (u.pathname.endsWith("/activities")) {
    const out = [];
    for (let d = u.searchParams.get("oldest")!; d < TODAY; d = addDays(d, 1)) {
      const dow = new Date(d + "T00:00:00Z").getUTCDay();
      if (dow === 1 || dow === 5) continue;
      const km = dow === 6 ? 18 : 8;
      out.push({ id: `a${d}`, start_date_local: `${d}T06:00:00`, type: "Run", name: "Run", distance: km * 1000, moving_time: km * 330, total_elevation_gain: km * 20, average_heartrate: 140, icu_training_load: km * 6 });
    }
    out.push({ id: "strava1", start_date_local: `${addDays(TODAY, -1)}T18:00:00`, type: "Run", source: "STRAVA", distance: null });
    return json(out);
  }
  if (u.pathname.endsWith("/wellness.json")) {
    const out = [];
    for (let d = u.searchParams.get("oldest")!; d <= TODAY; d = addDays(d, 1)) {
      const recent = d > addDays(TODAY, -5);
      out.push({ id: d, hrv: crashHrv && recent ? 35 : 60 + (d.charCodeAt(9) % 4), restingHR: 48, sleepSecs: 7.5 * 3600, vo2max: 54, ctl: 45, atl: 50 });
    }
    return json(out);
  }
  if (u.pathname.includes("/streams")) {
    const time: number[] = [];
    const distance: number[] = [];
    for (let i = 0; i <= 2000; i++) {
      time.push(i * 3);
      distance.push(i * 10);
    }
    return json([{ type: "time", data: time }, { type: "distance", data: distance }]);
  }
  if (u.pathname.endsWith("/events/bulk")) return json(body.map(() => ({ id: ++eventId })));
  if (u.pathname.endsWith("/events/bulk-delete")) return json({ eventsDeleted: body.length });
  return new Response("not found", { status: 404 });
}

const SCHEDULE = { trainingDays: [1, 3, 5, 6], longRunDay: 5 };

// ---- Scripted Claude -------------------------------------------------------
type Reply = (req: { messages: { role: string; content: unknown }[] }) => string;
const replies: Reply[] = [];
const claudeRequests: unknown[] = [];
const fakeAnthropic = {
  beta: {
    messages: {
      create: async (req: { messages: { role: string; content: unknown }[] }) => {
        claudeRequests.push(req);
        const text = replies.shift()!(req);
        return { model: "claude-opus-5-5", stop_reason: "end_turn", stop_details: null, content: [{ type: "text", text }] };
      },
    },
  },
} as never;

function validReply(req: { messages: { role: string; content: unknown }[] }) {
  const ctx = contextOf(req);
  const w = ctx.weekToPlan;
  const p = templates.generateTemplateWeek(
    { ...w.basePlan, weekStart: w.weekStart, phase: w.phase, isCutback: w.isCutback, index: 0, weeksOut: w.weeksToRace },
    { fromDate: w.planDatesFrom, availability: SCHEDULE, targetKm: Math.min(w.basePlan.targetKm, ctx.limits.targetKmMax), longRunKm: Math.min(w.basePlan.longRunKm, ctx.limits.longestRunMaxKm) },
  );
  return JSON.stringify({ ...p, rationale: `Planned ${w.weekStart}` });
}

function contextOf(req: { messages: { role: string; content: unknown }[] }) {
  const content = String(req.messages[0].content);
  return JSON.parse(content.slice(content.indexOf("{")));
}

// ---------------------------------------------------------------------------
let service: typeof import("./service");
let onboardingRequests: unknown[] = [];
let templates: typeof import("../engine/templates");

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T08:00:00+02:00`));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => fakeIntervals(url, init)));
  service = await import("./service");
  templates = await import("../engine/templates");
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  calls.length = 0;
  claudeRequests.length = 0;
});

describe("baseline from history", () => {
  it("derives the starting point from synced runs only", () => {
    const acts = [
      { date: "2026-09-24", distanceKm: 10.2, elevGainM: 215 },
      { date: "2026-10-03", distanceKm: 8.5, elevGainM: 59 },
    ].map((a, i) => ({ id: String(i), startLocal: a.date, type: "TrailRun", name: "", movingTimeS: 3600, avgHr: null, load: null, rpe: null, gapSpeed: null, bestEfforts: {}, ...a }));
    expect(service.baselineFromHistory(acts, "2026-10-04")).toEqual({ weeklyKm: 4.7, longestRunKm: 10.2, weeklyVertM: 69 });
  });
  it("falls back to a gentle default without history", () => {
    expect(service.baselineFromHistory([], "2026-10-04")).toEqual(service.NO_HISTORY_BASELINE);
  });
});

describe("service end to end", () => {
  it("onboards: skeleton, backfill, best efforts, Claude plan after one rejected attempt, pushed to watch", async () => {
    // Attempt 1: way too much volume -> rejected by guardrails. Attempt 2: valid.
    replies.push(
      (req) => {
        const ctx = contextOf(req);
        return JSON.stringify({ ...templates.generateTemplateWeek({ ...ctx.weekToPlan.basePlan, weekStart: ctx.weekToPlan.weekStart, phase: ctx.weekToPlan.phase, isCutback: false, index: 0, weeksOut: ctx.weekToPlan.weeksToRace }, { fromDate: ctx.weekToPlan.planDatesFrom, availability: SCHEDULE }), targetKm: 200 });
      },
      (req) => {
        expect(JSON.stringify(req.messages.at(-1))).toContain("rejected by the safety checks");
        const ctx = contextOf(req);
        const p = templates.generateTemplateWeek({ ...ctx.weekToPlan.basePlan, weekStart: ctx.weekToPlan.weekStart, phase: ctx.weekToPlan.phase, isCutback: false, index: 0, weeksOut: ctx.weekToPlan.weeksToRace }, { fromDate: ctx.weekToPlan.planDatesFrom, availability: SCHEDULE });
        return JSON.stringify({ ...p, rationale: "Consistent recent running, so we start right on plan." });
      },
      validReply,
      validReply,
      validReply,
    );

    await service.connectAthlete(
      "u1",
      "a@example.com",
      { displayName: "Arno", intervalsAthleteId: "i42", intervalsApiKey: "secret-key-123", availability: SCHEDULE },
      fakeAnthropic,
    );

    const weeks = [...store.keys()].filter((k) => k.startsWith("athletes/u1/weeks/"));
    expect(weeks.length).toBe(34);
    expect(store.get("private/u1")).toEqual({ intervalsApiKey: "secret-key-123" });
    expect(store.get("athletes/u1")).not.toHaveProperty("intervalsApiKey");

    const week = store.get("athletes/u1/weeks/2026-10-05")!;
    expect(week.source).toBe("claude");
    expect(week.rationale).toMatch(/Consistent/);
    // Baseline came from the synced history (fake: ~50 km/week), not from a form.
    expect((store.get("athletes/u1")!.baseline as { weeklyKm: number }).weeklyKm).toBeGreaterThan(40);
    const sessions = week.sessions as { date: string; type: string }[];
    expect(sessions[0].date).toBe(TODAY); // mid-week start: only today..Sunday
    expect(sessions.at(-1)!.date).toBe("2026-10-11");

    // Claude saw real data, and the context carried hard limits.
    const ctx = contextOf(claudeRequests[0] as never);
    expect(ctx.activitiesLast14Days.length).toBeGreaterThan(5);
    expect(ctx.limits.targetKmMax).toBeGreaterThan(0);
    expect(ctx.athlete.trainingDays).toEqual(["Tuesday", "Thursday", "Saturday", "Sunday"]);
    expect(ctx.athlete.longRunDay).toBe("Saturday");

    // Pushed to intervals.icu: one event per non-rest day, ids remembered.
    const pushed = calls.filter((c) => c.url.endsWith("/events/bulk"));
    expect(pushed).toHaveLength(4); // this week + 3 weeks ahead
    const runDays = sessions.filter((s) => s.type !== "rest").length;
    expect((pushed[0].body as unknown[]).length).toBe(runDays);
    expect(Object.keys(week.pushedEvents as object)).toHaveLength(runDays);

    // Strava-only activity skipped and flagged; best efforts computed from streams (3:00/km).
    expect(store.get("athletes/u1")!.stravaOnlyActivities).toBe(1);
    const act = [...store.entries()].find(([k]) => k.startsWith("athletes/u1/activities/"))![1];
    // Fake streams run 3:00/km: every distance inside the run is found.
    expect(act.bestEfforts).toEqual({ "1k": 300, "1mi": 483, "2mi": 966, "5k": 1500, "10k": 3000 });
    expect((store.get("stats/u1")!.bests as Record<string, { timeS: number }>)["1k"].timeS).toBe(300);

    onboardingRequests = [...claudeRequests];
    expect((store.get("athletes/u1")!.heartRate as { reliable: boolean }).reliable).toBe(true);
    const stats = store.get("stats/u1")!;
    expect(stats.displayName).toBe("Arno");
    expect(stats.vo2max).toBe(54);

    const log = [...store.entries()].filter(([k]) => k.startsWith("athletes/u1/adjustments/")).map(([, v]) => v);
    expect(log[0].source).toBe("claude");
    expect((log[0].rejectedAttempts as { errors: string[] }[])[0].errors.join()).toMatch(/exceeds the plan/);
  });

  it("plans 3 weeks ahead at setup, each pushed to the watch", async () => {
    for (const w of ["2026-10-12", "2026-10-19", "2026-10-26"]) {
      const week = store.get(`athletes/u1/weeks/${w}`)!;
      expect(week.source).toBe("claude");
      expect((week.sessions as unknown[]).length).toBe(7);
      expect(Object.keys(week.pushedEvents as object).length).toBeGreaterThan(0);
    }
    expect(store.get("athletes/u1/weeks/2026-11-02")!.source).toBe("none");
    // Week 3's limits were based on the planned (not yet run) weeks before it, not on zeros.
    const lastCtx = contextOf(onboardingRequests.at(-1) as never);
    expect(lastCtx.weekToPlan.weekStart).toBe("2026-10-26");
    expect(lastCtx.limits.targetKmMax).toBeGreaterThan(20);
    expect(lastCtx.recentWeeks.at(-1).status).toBe("planned, not yet run");
    expect(lastCtx.recentWeeks.at(-1).actualKm).toBeNull();
  });

  it("re-planning replaces previously pushed events instead of duplicating them", async () => {
    const before = store.get("athletes/u1/weeks/2026-10-05")!.pushedEvents as Record<string, number>;
    await service.planWeek("u1", "2026-10-05", { fromDate: TODAY, kind: "manual" }, null);
    const del = calls.find((c) => c.url.endsWith("/bulk-delete"))!;
    expect((del.body as { id: number }[]).map((x) => x.id).sort()).toEqual(Object.values(before).sort());
    expect(store.get("athletes/u1/weeks/2026-10-05")!.source).toBe("template");
  });

  it("falls back to the safe template when Claude fails twice", async () => {
    replies.push(() => "not json", () => JSON.stringify({ targetKm: 1, targetVertM: 0, rationale: "x", sessions: [] }));
    const r = await service.planWeek("u1", "2026-10-12", { kind: "weekly" }, fakeAnthropic);
    expect(r.source).toBe("template");
    expect(store.get("athletes/u1/weeks/2026-10-12")!.sessions).toHaveLength(7);
  });

  it("morning check: red readiness softens today and logs why", async () => {
    crashHrv = true;
    // Make today a hard session so the check has something to change.
    const week = store.get("athletes/u1/weeks/2026-10-05")!;
    const sessions = (week.sessions as { date: string; intensity: string; type: string; title: string }[]).map((s) =>
      s.date === TODAY ? { ...s, type: "intervals", intensity: "hard", title: "Intervals" } : s,
    );
    store.set("athletes/u1/weeks/2026-10-05", { ...week, sessions });

    const result = await service.morningCheck("u1", null);
    expect(result.readiness.level).toBe("red");
    expect(result.changed).toBe(true);
    const today = (store.get("athletes/u1/weeks/2026-10-05")!.sessions as { date: string; type: string }[]).find((s) => s.date === TODAY)!;
    expect(today.type).toBe("rest");
    const log = [...store.values()].filter((v) => v.kind === "daily");
    expect(log).toHaveLength(1);
    expect(log[0].rationale).toMatch(/HRV/);
  });
});
