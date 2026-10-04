import { addDays } from "../dates";
import type { ActivityDoc, HeartRateStatus } from "../types";
import { isPlausibleRun } from "./analysis";

/**
 * A recording is "clipped" when the heart rate sits at its own maximum for most
 * of the run: the average is within 3 bpm of the max over 10+ minutes. Real
 * runs never look like that; it happens when values above the athlete's max-HR
 * setting get capped.
 */
export function isHrClipped(a: Pick<ActivityDoc, "avgHr" | "maxHr" | "movingTimeS">): boolean {
  return !!a.avgHr && !!a.maxHr && a.movingTimeS >= 600 && a.avgHr >= a.maxHr - 3;
}

export function heartRateStatus(
  settings: { maxHr: number | null; lthr: number | null; zones: number[] | null },
  activities: ActivityDoc[],
  today: string,
): HeartRateStatus {
  // Judge on the latest runs, so fixing the settings clears the warning after a few clean runs.
  const recent = activities
    .filter((a) => a.date > addDays(today, -90) && isPlausibleRun(a) && a.avgHr && a.movingTimeS >= 600)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const clipped = recent.filter(isHrClipped);
  if (recent.length >= 3 && clipped.length * 2 > recent.length) {
    const cap = clipped[0].maxHr;
    const settingsRaised = settings.maxHr !== null && cap !== null && settings.maxHr > cap + 5;
    return {
      ...settings,
      reliable: false,
      issue: settingsRaised
        ? `Your Max HR is now ${settings.maxHr}, but ${clipped.length} of your last ${recent.length} runs were recorded capped at ${cap} bpm. Re-process them in intervals.icu, or this clears after a few new runs.`
        : `Heart rate is capped at ${cap} bpm in ${clipped.length} of your last ${recent.length} runs, so it isn't your real heart rate. Raise Max HR in intervals.icu (Settings → Run) so it stops clipping.`,
    };
  }
  // Threshold HR normally sits at ~85-92% of max; zones are built from it, so a low LTHR makes "easy" far too easy.
  if (settings.maxHr && settings.lthr && settings.lthr / settings.maxHr < 0.8) {
    return {
      ...settings,
      reliable: false,
      issue: `Threshold HR (${settings.lthr}) looks too low for a max of ${settings.maxHr}: your "easy" zone is only ${settings.zones?.[0] ?? "?"}-${settings.zones?.[1] ?? "?"} bpm. Set Threshold HR in intervals.icu (Settings → Run) after a 30-minute test run.`,
    };
  }
  if (!settings.maxHr && !settings.lthr) {
    return { ...settings, reliable: false, issue: "No heart-rate zones set in intervals.icu (Settings → Run)." };
  }
  return { ...settings, reliable: true, issue: null };
}

/** Share of running time spent easy (zones 1-2) over runs with trustworthy heart rate; null without data. */
export function easySharePct(activities: ActivityDoc[]): number | null {
  let easy = 0;
  let total = 0;
  for (const a of activities) {
    if (!a.hrZoneTimes || isHrClipped(a) || !isPlausibleRun(a)) continue;
    easy += (a.hrZoneTimes[0] ?? 0) + (a.hrZoneTimes[1] ?? 0);
    total += a.hrZoneTimes.reduce((s, t) => s + t, 0);
  }
  return total >= 1800 ? Math.round((easy / total) * 100) : null;
}

const EFFORT: [RegExp, string][] = [
  [/\bZ1-Z2 HR\b/g, "easy"],
  [/\bZ2-Z3 HR\b/g, "steady"],
  [/\bZ3-Z4 HR\b/g, "hard"],
  [/\bZ4-Z5 HR\b/g, "very hard"],
  [/\bZ1 HR\b/g, "very easy"],
  [/\bZ2 HR\b/g, "easy"],
  [/\bZ3 HR\b/g, "steady"],
  [/\bZ4 HR\b/g, "hard"],
  [/\bZ5 HR\b/g, "sprint"],
];

/** Replace heart-rate targets with effort words, for when the athlete's HR data can't be trusted. */
export function toEffortTargets(description: string): string {
  return EFFORT.reduce((d, [re, word]) => d.replace(re, word), description);
}
