// All plan dates are local calendar days as "YYYY-MM-DD" strings. Arithmetic
// runs on UTC midnights so it never drifts with DST or server timezone.

const DAY_MS = 86_400_000;

function parse(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return format(parse(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

/** Monday of the ISO week containing `date`. */
export function mondayOf(date: string): string {
  const dow = new Date(parse(date)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

/** 0 = Monday ... 6 = Sunday */
export function dayIndex(date: string): number {
  return (new Date(parse(date)).getUTCDay() + 6) % 7;
}

export function localToday(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
