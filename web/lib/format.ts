export const RACE = {
  name: "MUT 60 by UTMB",
  date: "2027-05-29",
  /** Start gun, George (SAST, UTC+2). The countdown runs to this moment, like the UTMB site. */
  start: "2027-05-29T06:30:00+02:00",
  distanceKm: 58,
  vertM: 3005,
  cutoffHours: 15,
  location: "George, South Africa",
};

const DAY_MS = 86_400_000;
const parse = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};

export const addDays = (d: string, n: number) => new Date(parse(d) + n * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((parse(b) - parse(a)) / DAY_MS);
export const mondayOf = (d: string) => addDays(d, -((new Date(parse(d)).getUTCDay() + 6) % 7));

export function localToday(timeZone = "Africa/Johannesburg"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function duration(s: number | null | undefined): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function pacePerKm(timeS: number, km: number): string {
  if (!km) return "—";
  const p = timeS / km;
  return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, "0")}/km`;
}

export const shortDate = (d: string) =>
  new Date(parse(d)).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "UTC" });

export const weekday = (d: string) => new Date(parse(d)).toLocaleDateString("en-ZA", { weekday: "short", timeZone: "UTC" });

export const km = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${v.toFixed(digits)} km`);

export const PHASE_LABEL: Record<string, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
  race: "Race week",
};

/** "Mon 5 Oct 2026" */
export function dayLabel(d: string): string {
  const date = new Date(parse(d));
  const wd = date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const rest = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${wd} ${rest}`;
}

/** "22 Oct 2025" */
export const fullDate = (d: string) =>
  new Date(parse(d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Time left until the race start, counted like the UTMB site: full days, then hours and minutes. */
export function raceCountdown(now: Date = new Date()) {
  const ms = Math.max(0, new Date(RACE.start).getTime() - now.getTime());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
  };
}
