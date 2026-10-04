import { RACE } from "../config";
import { weekDates } from "../dates";
import type { Intensity, Phase, Proposal, Session, SessionType, SkeletonWeek } from "../types";

// Deterministic week builder. Used for the first week before there is any history,
// and as the safe fallback whenever the AI coach's proposal fails the guardrails.

type Slot =
  | "rest"
  | "easy"
  | "easyStrides"
  | "recovery"
  | "hills"
  | "intervals"
  | "tempo"
  | "long"
  | "medium"
  | "shakeout"
  | "race";

/** Quality sessions per phase, most important first. */
const QUALITY: Record<Exclude<Phase, "race">, Slot[]> = {
  base: ["hills", "easyStrides"],
  build: ["hills", "intervals"],
  peak: ["hills", "tempo"],
  taper: ["intervals", "tempo"],
};

export interface Availability {
  /** Days the athlete can train: 0 = Monday ... 6 = Sunday. */
  trainingDays: number[];
  longRunDay: number;
}

export const DEFAULT_AVAILABILITY: Availability = { trainingDays: [1, 2, 3, 5, 6], longRunDay: 6 };

/**
 * Place the week's sessions on the athlete's training days. Returns the slot for
 * each weekday plus the order in which run days are turned into rest days when
 * the week's volume is too small to spread over all of them.
 */
export function placeSlots(week: SkeletonWeek, availability: Availability): { slots: Slot[]; dropOrder: number[] } {
  const slots: Slot[] = Array(7).fill("rest");
  const days = [...new Set(availability.trainingDays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);

  if (week.phase === "race") {
    // Race is on Saturday (index 5) regardless of usual days; keep the rest light.
    slots[5] = "race";
    const before = days.filter((d) => d <= 3);
    if (before[0] !== undefined) slots[before[0]] = "easyStrides";
    if (before[1] !== undefined) slots[before[1]] = "easy";
    if (days.includes(4)) slots[4] = "shakeout";
    return { slots, dropOrder: [] };
  }

  const longDay = days.includes(availability.longRunDay) ? availability.longRunDay : days[days.length - 1];
  slots[longDay] = "long";
  let free = days.filter((d) => d !== longDay);

  // Back-to-back weekend in the peak phase: easy medium-long the day after (or before) the long run.
  let b2b: number | undefined;
  if (week.phase === "peak" && !week.isCutback) {
    b2b = free.find((d) => d === longDay + 1) ?? free.find((d) => d === longDay - 1);
    if (b2b !== undefined) {
      slots[b2b] = "medium";
      free = free.filter((d) => d !== b2b);
    }
  }

  // Quality sessions: never the day before or after the long run, never on consecutive days.
  const quality = QUALITY[week.phase].map((q) => (week.isCutback && (q === "intervals" || q === "tempo") ? "easyStrides" : q));
  const hardDays: number[] = [];
  const candidates = free.filter((d) => d !== longDay - 1 && d !== longDay + 1 && d !== (b2b ?? -9) - 1);
  for (const q of quality) {
    const day = candidates.find((d) => !hardDays.some((h) => Math.abs(h - d) <= 1));
    if (day === undefined) break;
    slots[day] = q;
    hardDays.push(day);
  }
  free = free.filter((d) => !hardDays.includes(d));

  for (const d of free) slots[d] = d === longDay + 1 ? "recovery" : "easy";

  // Drop easy/recovery days first (latest in the week first), then the second quality session.
  const easyDays = free.slice().reverse();
  const dropOrder = [...easyDays, ...(b2b !== undefined ? [b2b] : []), ...hardDays.slice(1).reverse()];
  return { slots, dropOrder };
}

const MIN_RUN_KM = 4;
const MIN_RUN_KM_LOW_VOLUME = 3;
const LOW_VOLUME_KM = 30;
/** The long run may take at most this share of a non-race week, so small weeks keep several runs. */
const MAX_LONG_SHARE = 0.5;
const MAX_LONG_SHARE_LOW_VOLUME = 0.4;
const SHAKEOUT_KM = 4;

const WEIGHT: Partial<Record<Slot, number>> = {
  easy: 1,
  easyStrides: 1,
  recovery: 0.6,
  hills: 0.9,
  intervals: 0.9,
  tempo: 1,
  medium: 1.6,
};

const round = (v: number, step: number) => Math.round(v / step) * step;

function intensityFor(slot: Slot, week: SkeletonWeek): Intensity {
  switch (slot) {
    case "rest":
      return "rest";
    case "hills":
      return week.phase === "base" || week.isCutback ? "moderate" : "hard";
    case "intervals":
      return "hard";
    case "tempo":
      return week.phase === "taper" ? "moderate" : "hard";
    case "long":
      return week.weeksOut === 4 ? "moderate" : "easy";
    case "race":
      return "hard";
    default:
      return "easy";
  }
}

function typeFor(slot: Slot): SessionType {
  switch (slot) {
    case "easyStrides":
    case "medium":
    case "shakeout":
      return "easy";
    default:
      return slot;
  }
}

function hillsSet(week: SkeletonWeek): string {
  if (week.phase === "base") return week.index < 6 ? "6x\n- 60s Z4 HR uphill\n- 2m Z1 HR down" : "8x\n- 90s Z4 HR uphill\n- 2m Z1 HR down";
  if (week.phase === "build") return "8x\n- 2m Z4 HR uphill\n- 2m30s Z1 HR down";
  return "4x\n- 6m Z3-Z4 HR climb\n- 4m Z1 HR down";
}

const steps = (...blocks: string[]) => blocks.join("\n\n");

function describe(slot: Slot, week: SkeletonWeek, km: number): { title: string; description: string; note: string } {
  switch (slot) {
    case "rest":
      return { title: "Rest", description: "", note: "Optional: 20 min strength (squats, step-downs, calf raises)." };
    case "easy":
      return { title: "Easy run", description: `- ${km}km Z2 HR`, note: "" };
    case "easyStrides":
      return { title: "Easy + strides", description: steps(`- ${Math.max(km - 1, 1)}km Z2 HR`, "6x\n- 20s Z5 HR\n- 60s Z1 HR"), note: "" };
    case "recovery":
      return { title: "Recovery run", description: `- ${km}km Z1 HR`, note: "" };
    case "medium":
      return { title: "Back-to-back run", description: `- ${km}km Z2 HR`, note: "Run on yesterday's tired legs." };
    case "hills":
      return { title: "Hill repeats", description: steps("- 15m Z2 HR", hillsSet(week), "- 10m Z1 HR"), note: "" };
    case "intervals":
      return {
        title: "Intervals",
        description: steps("- 15m Z2 HR", week.phase === "taper" ? "4x\n- 3m Z4 HR\n- 2m Z1 HR" : "6x\n- 3m Z4 HR\n- 2m Z1 HR", "- 10m Z1 HR"),
        note: "",
      };
    case "tempo":
      return {
        title: "Tempo",
        description: steps("- 15m Z2 HR", week.phase === "taper" ? "2x\n- 8m Z3 HR\n- 3m Z1 HR" : "3x\n- 10m Z3 HR\n- 3m Z1 HR", "- 10m Z1 HR"),
        note: "",
      };
    case "long":
      return week.weeksOut === 4
        ? { title: "Race simulation", description: `- ${km}km Z2 HR`, note: "Race kit, race fuel (60-90 g carbs/h), hike the climbs." }
        : { title: "Long trail run", description: `- ${km}km Z2 HR`, note: "Hike steep climbs. Fuel 60-90 g carbs/h." };
    case "shakeout":
      return { title: "Shakeout", description: steps(`- ${km}km Z1 HR`, "4x\n- 15s Z4 HR\n- 45s Z1 HR"), note: "" };
    case "race":
      return { title: RACE.name, description: "", note: `Start ${RACE.startTime}. Go easy early, hike the climbs, fuel every 30 min.` };
  }
}

function estimateMinutes(slot: Slot, km: number, vert: number): number {
  if (slot === "rest") return 0;
  const perKm = slot === "long" || slot === "race" || slot === "medium" ? 7.5 : 6.5;
  return round(km * perKm + vert / 10, 5);
}

export function generateTemplateWeek(
  week: SkeletonWeek,
  opts: { fromDate?: string; targetKm?: number; targetVertM?: number; longRunKm?: number; availability?: Availability } = {},
): Proposal {
  const targetKm = opts.targetKm ?? week.targetKm;
  const targetVertM = opts.targetVertM ?? week.targetVertM;
  if (opts.longRunKm !== undefined && week.phase !== "race") week = { ...week, longRunKm: opts.longRunKm };
  const lowVolume = targetKm < LOW_VOLUME_KM;
  const longShare = lowVolume ? MAX_LONG_SHARE_LOW_VOLUME : MAX_LONG_SHARE;
  if (week.phase !== "race" && week.longRunKm > targetKm * longShare) {
    week = { ...week, longRunKm: Math.floor(targetKm * longShare * 2) / 2 };
  }
  const minRunKm = lowVolume ? MIN_RUN_KM_LOW_VOLUME : MIN_RUN_KM;
  const dates = weekDates(week.weekStart);
  const { slots, dropOrder } = placeSlots(week, opts.availability ?? DEFAULT_AVAILABILITY);

  const fixedKm = (slot: Slot) =>
    slot === "long" ? week.longRunKm : slot === "shakeout" ? SHAKEOUT_KM : slot === "race" ? RACE.distanceKm : 0;

  // Distribute remaining volume across flexible run days; turn days into rest
  // until every run is at least the minimum run distance.
  const nonRaceFixed = slots.reduce((sum, s) => sum + (s === "race" ? 0 : fixedKm(s)), 0);
  const remainder = Math.max(0, targetKm - nonRaceFixed);
  let km: number[] = [];
  for (let drops = 0; drops <= dropOrder.length; drops++) {
    const totalWeight = slots.reduce((sum, s) => sum + (WEIGHT[s] ?? 0), 0);
    km = slots.map((s) => fixedKm(s) || (totalWeight > 0 ? (remainder * (WEIGHT[s] ?? 0)) / totalWeight : 0));
    const tooShort = slots.some((s, i) => WEIGHT[s] !== undefined && km[i] < minRunKm);
    if (!tooShort || drops === dropOrder.length) break;
    const victim = dropOrder.find((i) => WEIGHT[slots[i]] !== undefined);
    if (victim === undefined) break;
    slots[victim] = "rest";
  }
  km = km.map((v, i) => (slots[i] === "rest" ? 0 : round(v, 0.5)));

  // Climbing: long run carries the biggest share, hill session the next.
  const vert = slots.map(() => 0);
  const longIdx = slots.indexOf("long");
  const hillIdx = slots.indexOf("hills");
  let vertLeft = week.phase === "race" ? 0 : targetVertM;
  // Race simulation gets race-like climbing (~52 m/km on race day).
  const longVertShare = week.weeksOut === 4 ? 0.65 : 0.45;
  if (longIdx >= 0) vert[longIdx] = Math.min(targetVertM * longVertShare, km[longIdx] * 70);
  if (hillIdx >= 0) vert[hillIdx] = Math.min(targetVertM * 0.2, km[hillIdx] * 80);
  vertLeft -= vert[longIdx] ?? 0;
  vertLeft -= vert[hillIdx] ?? 0;
  const otherKm = slots.reduce(
    (sum, s, i) => sum + (i !== longIdx && i !== hillIdx && s !== "rest" && s !== "race" ? km[i] : 0),
    0,
  );
  slots.forEach((s, i) => {
    if (i === longIdx || i === hillIdx || s === "rest") return;
    if (s === "race") vert[i] = RACE.vertM;
    else if (otherKm > 0) vert[i] = Math.min((Math.max(vertLeft, 0) * km[i]) / otherKm, km[i] * 60);
  });

  const sessions: Session[] = slots
    .map((slot, i) => {
      const distanceKm = km[i];
      const vertM = round(vert[i], 10);
      return {
        date: dates[i],
        type: typeFor(slot),
        intensity: intensityFor(slot, week),
        distanceKm,
        vertM,
        durationMin: estimateMinutes(slot, distanceKm, vertM),
        ...describe(slot, week, distanceKm),
      };
    })
    .filter((s) => !opts.fromDate || s.date >= opts.fromDate);

  return {
    targetKm,
    targetVertM,
    sessions,
    rationale: `Standard ${week.phase}${week.isCutback ? " (cutback)" : ""} week from the base plan: ${targetKm} km and ${targetVertM} m of climbing.`,
  };
}
