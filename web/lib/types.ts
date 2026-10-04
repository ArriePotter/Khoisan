// Mirrors the documents written by ../functions (see functions/src/types.ts,
// functions/src/engine/stats.ts and functions/src/coach/service.ts).

export type Phase = "base" | "build" | "peak" | "taper" | "race";
export type Intensity = "rest" | "easy" | "moderate" | "hard";

export interface Session {
  date: string;
  type: string;
  title: string;
  distanceKm: number;
  vertM: number;
  durationMin: number;
  intensity: Intensity;
  description: string;
  /** One short line, may be empty (older plans don't have it). */
  note?: string;
}

export interface WeekPlan {
  weekStart: string;
  index: number;
  weeksOut: number;
  phase: Phase;
  isCutback: boolean;
  targetKm: number;
  targetVertM: number;
  longRunKm: number;
  plannedKm: number;
  plannedVertM: number;
  sessions: Session[];
  source: "none" | "template" | "claude";
  rationale: string;
  updatedAt?: string;
}

export interface Readiness {
  date: string;
  level: "green" | "amber" | "red" | "unknown";
  reasons: string[];
  metrics: {
    hrv: number | null;
    hrvBaseline: number | null;
    restingHR: number | null;
    restingHRBaseline: number | null;
    sleepH: number | null;
    sleepScore?: number | null;
    form: number | null;
  };
}

export interface Athlete {
  uid: string;
  displayName: string;
  timezone: string;
  planStart: string;
  baseline: { weeklyKm: number; longestRunKm: number; weeklyVertM?: number };
  readiness?: Readiness;
  heartRate?: HeartRateStatus;
  lastSyncAt?: string;
  stravaOnlyActivities?: number;
}

export interface HeartRateStatus {
  maxHr: number | null;
  lthr: number | null;
  zones: number[] | null;
  reliable: boolean;
  issue: string | null;
}

export interface Activity {
  id: string;
  date: string;
  startLocal: string;
  type: string;
  name: string;
  distanceKm: number;
  movingTimeS: number;
  elevGainM: number;
  avgHr: number | null;
  descentM?: number;
  bestEfforts?: Partial<Record<EffortKey, number>>;
}

export interface Wellness {
  date: string;
  hrv: number | null;
  restingHR: number | null;
  sleepH: number | null;
  sleepScore?: number | null;
  vo2max: number | null;
  ctl: number | null;
  atl: number | null;
}

export interface Adjustment {
  id: string;
  createdAt: string;
  kind: "initial" | "weekly" | "daily" | "manual" | "rebase";
  weekStart: string;
  source: "claude" | "template" | "rules";
  rationale: string;
  readiness?: string;
  basePlanKm?: number;
  plannedKm?: number;
  rejectedAttempts?: { errors: string[] }[];
}

export interface BestMark {
  timeS: number;
  date: string;
  activityId: string;
}

export type EffortKey = "1k" | "1mi" | "2mi" | "5k" | "10k";

export const EFFORT_LABELS: { key: EffortKey; label: string }[] = [
  { key: "1k", label: "1 km" },
  { key: "1mi", label: "1 mile" },
  { key: "2mi", label: "2 miles" },
  { key: "5k", label: "5 km" },
  { key: "10k", label: "10 km" },
];

export interface RunHighlight {
  activityId: string;
  date: string;
  name: string;
  distanceKm: number;
  feel?: number | null;
  avgTempC?: number | null;
  /** Efficiency (grade-adjusted pace per heartbeat) vs the athlete's typical run. */
  vsTypicalPct: number;
}

export interface CompareStats {
  displayName: string;
  updatedAt: string;
  planStart: string | null;
  totalKm: number;
  totalVertM: number;
  totalHours: number;
  last7Km: number;
  last28Km: number;
  bests?: Partial<Record<EffortKey, BestMark | null>>;
  longestRun?: (BestMark & { distanceKm: number; name: string }) | null;
  strongestRun?: RunHighlight | null;
  weakestRun?: RunHighlight | null;
  vo2max: number | null;
  vo2maxSeries: { date: string; value: number }[];
  fitness: number | null;
  compliancePct: number | null;
  easySharePct28?: number | null;
  heartRate?: HeartRateStatus | null;
  weekly: { weekStart: string; km: number; vertM: number; descentM?: number; runs: number; longestKm: number }[];
}
