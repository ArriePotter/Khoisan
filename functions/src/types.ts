export type Phase = "base" | "build" | "peak" | "taper" | "race";

export const SESSION_TYPES = [
  "rest",
  "easy",
  "recovery",
  "long",
  "hills",
  "intervals",
  "tempo",
  "strength",
  "mobility",
  "race",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const INTENSITIES = ["rest", "easy", "moderate", "hard"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export interface Session {
  date: string;
  type: SessionType;
  title: string;
  distanceKm: number;
  vertM: number;
  durationMin: number;
  intensity: Intensity;
  /**
   * Runs: workout steps only, in intervals.icu text syntax ("- 15m Z2 HR").
   * Strength/mobility: one exercise per line ("Single-leg squats 3x10"). No prose.
   */
  description: string;
  /** Optional single short line (<= 80 chars), e.g. "Bring race kit". Empty when nothing essential. */
  note: string;
}

export interface Baseline {
  weeklyKm: number;
  longestRunKm: number;
  weeklyVertM?: number;
}

/** The fixed, code-generated periodisation for one week. */
export interface SkeletonWeek {
  weekStart: string;
  index: number;
  weeksOut: number;
  phase: Phase;
  isCutback: boolean;
  targetKm: number;
  targetVertM: number;
  longRunKm: number;
}

export interface WeekPlan extends SkeletonWeek {
  /** Targets after the coach's adjustment (always inside guardrails). */
  plannedKm: number;
  plannedVertM: number;
  sessions: Session[];
  source: "none" | "template" | "claude";
  rationale: string;
  /** intervals.icu event id per date, so re-plans replace rather than duplicate. */
  pushedEvents: Record<string, number>;
  updatedAt?: string;
}

export interface Proposal {
  targetKm: number;
  targetVertM: number;
  sessions: Session[];
  rationale: string;
}

export interface ActivityDoc {
  id: string;
  date: string;
  startLocal: string;
  type: string;
  name: string;
  distanceKm: number;
  movingTimeS: number;
  elevGainM: number;
  avgHr: number | null;
  load: number | null;
  rpe: number | null;
  /** Grade-adjusted average speed (m/s) from intervals.icu. */
  gapSpeed: number | null;
  maxHr: number | null;
  /** Seconds in each heart-rate zone (intervals.icu zones, Z1 first). */
  hrZoneTimes: number[] | null;
  descentM: number;
  /** intervals.icu "feel": 1 strong, 2 good, 3 normal, 4 poor, 5 weak. */
  feel: number | null;
  avgTempC: number | null;
  /** Fastest time (s) for each tracked distance found anywhere inside this run. */
  bestEfforts: Partial<Record<"1k" | "1mi" | "2mi" | "5k" | "10k", number>>;
  effortsVersion?: number;
}

export interface WellnessDoc {
  date: string;
  hrv: number | null;
  restingHR: number | null;
  sleepH: number | null;
  /** 0-100 sleep score from the watch. */
  sleepScore: number | null;
  vo2max: number | null;
  ctl: number | null;
  atl: number | null;
  readiness: number | null;
}

export type ReadinessLevel = "green" | "amber" | "red" | "unknown";

export interface Readiness {
  date: string;
  level: ReadinessLevel;
  reasons: string[];
  metrics: {
    hrv: number | null;
    hrvBaseline: number | null;
    restingHR: number | null;
    restingHRBaseline: number | null;
    sleepH: number | null;
    sleepScore: number | null;
    form: number | null;
  };
}

/** The athlete's running heart-rate settings in intervals.icu, and whether the recorded data can be trusted. */
export interface HeartRateStatus {
  maxHr: number | null;
  lthr: number | null;
  zones: number[] | null;
  /** False when recordings are clipped at the max-HR setting (or zones clearly don't fit the data). */
  reliable: boolean;
  issue: string | null;
}
