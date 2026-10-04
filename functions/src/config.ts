export const RACE = {
  name: "MUT 60 by UTMB",
  location: "George, South Africa (Outeniqua Mountains)",
  date: "2027-05-29",
  startTime: "06:30",
  distanceKm: 58,
  vertM: 3005,
  cutoffHours: 15,
  terrain:
    "Big climbs, rocky trails and technical descents: fynbos, forest, Cradock and Montagu passes.",
} as const;

export const DEFAULT_TIMEZONE = "Africa/Johannesburg";

export const COACH_MODEL = "claude-opus-5-5";

// Days of history pulled on first connect, and on every routine sync.
export const BACKFILL_DAYS = 365;
export const ROUTINE_SYNC_DAYS = 10;

export const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
