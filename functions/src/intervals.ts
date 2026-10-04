import type { ActivityDoc, Session, WellnessDoc } from "./types";
import { parseExerciseLine, readableExercise } from "./engine/exercises";

// Thin client for the intervals.icu REST API (https://intervals.icu/api/v1/docs).
// Auth: HTTP basic with username "API_KEY" and the athlete's personal key.

const BASE = "https://intervals.icu/api/v1";

export class IntervalsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class IntervalsClient {
  private readonly auth: string;

  constructor(
    readonly athleteId: string,
    apiKey: string,
  ) {
    this.auth = "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: this.auth,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new IntervalsError(`intervals.icu ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`, res.status);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  getAthlete() {
    return this.request<{ id: string; name?: string; sportSettings?: { types?: string[]; max_hr?: number | null; lthr?: number | null; hr_zones?: number[] | null }[] }>(
      "GET",
      `/athlete/${this.athleteId}`,
    );
  }

  async listActivities(oldest: string, newest: string): Promise<RawActivity[]> {
    const q = new URLSearchParams({ oldest, newest });
    return this.request<RawActivity[]>("GET", `/athlete/${this.athleteId}/activities?${q}`);
  }

  async listWellness(oldest: string, newest: string): Promise<RawWellness[]> {
    const q = new URLSearchParams({ oldest, newest });
    return this.request<RawWellness[]>("GET", `/athlete/${this.athleteId}/wellness.json?${q}`);
  }

  async getStreams(activityId: string, types: string[]): Promise<Record<string, number[]>> {
    const q = new URLSearchParams({ types: types.join(",") });
    const raw = await this.request<unknown>("GET", `/activity/${activityId}/streams.json?${q}`);
    const out: Record<string, number[]> = {};
    const list = Array.isArray(raw) ? raw : [];
    for (const s of list as { type?: string; data?: number[] }[]) {
      if (s?.type && Array.isArray(s.data)) out[s.type] = s.data;
    }
    return out;
  }

  createEvents(events: IntervalsEvent[]) {
    const q = new URLSearchParams({ upsert: "false", upsertOnUid: "false", updatePlanApplied: "false" });
    return this.request<{ id: number }[]>("POST", `/athlete/${this.athleteId}/events/bulk?${q}`, events);
  }

  deleteEvents(ids: number[]) {
    if (ids.length === 0) return Promise.resolve(undefined);
    return this.request("PUT", `/athlete/${this.athleteId}/events/bulk-delete`, ids.map((id) => ({ id })));
  }
}

export interface RawActivity {
  id: string;
  start_date_local: string;
  type?: string;
  name?: string;
  distance?: number | null;
  icu_distance?: number | null;
  moving_time?: number | null;
  total_elevation_gain?: number | null;
  average_heartrate?: number | null;
  icu_training_load?: number | null;
  icu_rpe?: number | null;
  perceived_exertion?: number | null;
  gap?: number | null;
  max_heartrate?: number | null;
  icu_hr_zone_times?: number[] | null;
  total_elevation_loss?: number | null;
  feel?: number | null;
  average_temp?: number | null;
  source?: string;
}

export interface RawWellness {
  id: string;
  hrv?: number | null;
  restingHR?: number | null;
  sleepSecs?: number | null;
  sleepScore?: number | null;
  vo2max?: number | null;
  ctl?: number | null;
  atl?: number | null;
  readiness?: number | null;
}

export interface IntervalsEvent {
  category: "WORKOUT" | "NOTE";
  start_date_local: string;
  type?: string;
  name: string;
  description: string;
  moving_time?: number;
  distance?: number;
  external_id: string;
}

const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function normalizeActivity(a: RawActivity): Omit<ActivityDoc, "bestEfforts" | "effortsVersion"> {
  const meters = num(a.distance) ?? num(a.icu_distance) ?? 0;
  return {
    id: String(a.id),
    date: a.start_date_local.slice(0, 10),
    startLocal: a.start_date_local,
    type: a.type ?? "Other",
    name: a.name ?? "",
    distanceKm: Math.round(meters / 10) / 100,
    movingTimeS: num(a.moving_time) ?? 0,
    elevGainM: Math.round(num(a.total_elevation_gain) ?? 0),
    avgHr: num(a.average_heartrate),
    load: num(a.icu_training_load),
    rpe: num(a.icu_rpe) ?? num(a.perceived_exertion),
    gapSpeed: num(a.gap),
    maxHr: num(a.max_heartrate),
    hrZoneTimes: Array.isArray(a.icu_hr_zone_times) && a.icu_hr_zone_times.length ? a.icu_hr_zone_times : null,
    descentM: Math.round(num(a.total_elevation_loss) ?? 0),
    feel: num(a.feel),
    avgTempC: num(a.average_temp) !== null ? Math.round(num(a.average_temp)! * 10) / 10 : null,
  };
}

export function normalizeWellness(w: RawWellness): WellnessDoc {
  const sleep = num(w.sleepSecs);
  return {
    date: w.id,
    hrv: num(w.hrv),
    restingHR: num(w.restingHR),
    sleepH: sleep !== null ? Math.round((sleep / 3600) * 10) / 10 : null,
    sleepScore: num(w.sleepScore),
    vo2max: num(w.vo2max),
    ctl: num(w.ctl),
    atl: num(w.atl),
    readiness: num(w.readiness),
  };
}

export function sessionToEvent(s: Session): IntervalsEvent | null {
  if (s.type === "rest") return null;
  const isStrength = s.type === "strength" || s.type === "mobility";
  return {
    category: "WORKOUT",
    start_date_local: `${s.date}T00:00:00`,
    type: isStrength ? "WeightTraining" : s.type === "race" ? "TrailRun" : "Run",
    name: s.title,
    description: [isStrength ? gymText(s.description) : s.description, s.note].filter(Boolean).join("\n\n"),
    moving_time: s.durationMin * 60,
    distance: isStrength ? undefined : Math.round(s.distanceKm * 1000),
    external_id: `mut60-${s.date}`,
  };
}

/** Exercise ids are for the app; the watch calendar gets readable names. */
function gymText(description: string): string {
  return description
    .split("\n")
    .map((l) => {
      const p = parseExerciseLine(l);
      return p ? readableExercise(p) : l;
    })
    .join("\n");
}
