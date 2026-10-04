import { addDays } from "../dates";
import type { Readiness, ReadinessLevel, WellnessDoc } from "../types";

// Morning readiness from the athlete's own baselines, in the spirit of Garmin's
// Training Readiness / HRV Status: compare today against personal norms rather
// than population numbers.

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

function values(rows: WellnessDoc[], key: "hrv" | "restingHR"): number[] {
  return rows.map((r) => r[key]).filter((v): v is number => typeof v === "number" && v > 0);
}

export function computeReadiness(today: string, wellness: WellnessDoc[]): Readiness {
  const byDate = new Map(wellness.map((w) => [w.date, w]));
  const todayRow = byDate.get(today) ?? byDate.get(addDays(today, -1)) ?? null;
  const history = wellness.filter((w) => w.date < today && w.date >= addDays(today, -60));
  const last7 = wellness.filter((w) => w.date <= today && w.date > addDays(today, -7));

  const reasons: string[] = [];
  let amber = 0;
  let red = 0;

  const hrvHist = values(history, "hrv");
  const hrvToday = todayRow?.hrv ?? null;
  let hrvBaseline: number | null = null;
  if (hrvHist.length >= 14 && hrvToday) {
    hrvBaseline = mean(hrvHist);
    const spread = Math.max(sd(hrvHist), hrvBaseline * 0.05);
    const hrv7 = values(last7, "hrv");
    const rolling = hrv7.length ? mean(hrv7) : hrvToday;
    const todayLow = hrvToday < hrvBaseline - 1.5 * spread;
    const trendLow = rolling < hrvBaseline - 1.0 * spread;
    if (todayLow && trendLow) {
      red++;
      reasons.push(`HRV ${hrvToday.toFixed(0)} ms and 7-day average ${rolling.toFixed(0)} ms are both well below your baseline of ${hrvBaseline.toFixed(0)} ms.`);
    } else if (todayLow || trendLow) {
      amber++;
      reasons.push(
        todayLow
          ? `HRV ${hrvToday.toFixed(0)} ms is well below your baseline of ${hrvBaseline.toFixed(0)} ms.`
          : `7-day HRV average ${rolling.toFixed(0)} ms is trending below your baseline of ${hrvBaseline.toFixed(0)} ms.`,
      );
    }
  }

  const rhrHist = values(history, "restingHR");
  const rhrToday = todayRow?.restingHR ?? null;
  let rhrBaseline: number | null = null;
  if (rhrHist.length >= 14 && rhrToday) {
    rhrBaseline = mean(rhrHist);
    const delta = rhrToday - rhrBaseline;
    if (delta >= 8) {
      red++;
      reasons.push(`Resting HR ${rhrToday} bpm is ${delta.toFixed(0)} bpm above normal; possible illness or heavy fatigue.`);
    } else if (delta >= 5) {
      amber++;
      reasons.push(`Resting HR ${rhrToday} bpm is ${delta.toFixed(0)} bpm above normal.`);
    }
  }

  // Last night's sleep: Garmin (via intervals.icu) files sleep under the date the night
  // started, so this morning it sits on yesterday's row. Other sources use the wake-up date.
  const sleepRow = lastNightSleep(today, byDate);
  const sleepH = sleepRow?.sleepH ?? null;
  const sleepScore = sleepRow?.sleepScore ?? null;
  if (sleepH !== null && sleepH < 4.5) {
    amber += 2;
    reasons.push(`Only ${sleepH.toFixed(1)} h sleep.`);
  } else if ((sleepH !== null && sleepH < 6) || (sleepScore !== null && sleepScore < 50)) {
    amber++;
    reasons.push(sleepScore !== null && sleepScore < 50 ? `Poor sleep (score ${sleepScore.toFixed(0)}${sleepH !== null ? `, ${sleepH.toFixed(1)} h` : ""}).` : `Short sleep (${sleepH!.toFixed(1)} h).`);
  }

  const form = todayRow && todayRow.ctl !== null && todayRow.atl !== null ? todayRow.ctl - todayRow.atl : null;
  if (form !== null && form < -30) {
    amber++;
    reasons.push(`Form (fitness minus fatigue) is ${form.toFixed(0)}: carrying a lot of fatigue.`);
  }

  const hasSignals = hrvBaseline !== null || rhrBaseline !== null || sleepH !== null || sleepScore !== null || form !== null;
  let level: ReadinessLevel;
  if (!hasSignals) level = "unknown";
  else if (red > 0 || amber >= 3) level = "red";
  else if (amber > 0) level = "amber";
  else level = "green";

  if (level === "green") reasons.push("Recovery markers are within your normal range.");
  if (level === "unknown") reasons.push("Not enough wellness data yet (needs ~2 weeks of HRV/resting HR from your watch).");

  return {
    date: today,
    level,
    reasons,
    metrics: { hrv: hrvToday, hrvBaseline, restingHR: rhrToday, restingHRBaseline: rhrBaseline, sleepH, sleepScore, form },
  };
}

/** The most recent night's sleep as of `today`: today's row if it has sleep, else yesterday's. */
export function lastNightSleep(today: string, byDate: Map<string, WellnessDoc>): WellnessDoc | null {
  const hasSleep = (w?: WellnessDoc) => !!w && (w.sleepH != null || w.sleepScore != null);
  const t = byDate.get(today);
  if (hasSleep(t)) return t!;
  const y = byDate.get(addDays(today, -1));
  return hasSleep(y) ? y! : null;
}
