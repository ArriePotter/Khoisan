import { addDays } from "../dates";
import type { ReadinessLevel, Session } from "../types";

/**
 * Deterministic fallback for the morning check: soften today (and a hard
 * session tomorrow) when recovery markers are off. Never adds load.
 */
export function downgradeForReadiness(sessions: Session[], today: string, level: ReadinessLevel): Session[] {
  if (level !== "red" && level !== "amber") return sessions;
  const tomorrow = addDays(today, 1);
  return sessions.map((s) => {
    if (s.type === "race" || s.type === "rest") return s;
    if (s.date === today && level === "red") {
      return s.intensity === "hard" || s.intensity === "moderate"
        ? { ...s, type: "rest", intensity: "rest", title: "Rest (recovery flag)", distanceKm: 0, vertM: 0, durationMin: 0, description: "", note: "Recovery is low today: rest. A gentle walk is fine." }
        : easyVersion(s, 0.6);
    }
    if (s.intensity !== "hard") return s;
    if (s.date === today || (s.date === tomorrow && level === "red")) return easyVersion(s, 0.8);
    return s;
  });
}

function easyVersion(s: Session, factor: number): Session {
  const km = Math.round(s.distanceKm * factor * 2) / 2;
  return {
    ...s,
    type: "easy",
    intensity: "easy",
    title: "Easy run (adjusted)",
    distanceKm: km,
    vertM: Math.round(s.vertM * factor),
    durationMin: Math.round(s.durationMin * factor),
    description: `- ${km}km Z1-Z2 HR`,
    note: "Softened: recovery is below normal today.",
  };
}

/**
 * Rebuild the skeleton from current fitness when the athlete has fallen well
 * behind (illness, injury, life). Two consecutive completed weeks under 60% of
 * plan triggers it, so one bad week alone does not.
 */
export function shouldRebase(recent: { targetKm: number; actualKm: number }[]): boolean {
  const lastTwo = recent.slice(-2);
  return lastTwo.length === 2 && lastTwo.every((w) => w.targetKm > 0 && w.actualKm < w.targetKm * 0.6);
}
