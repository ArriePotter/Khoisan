// Strength & mobility exercises the coach may prescribe. Strength/mobility
// sessions reference these by id, one per line: "<id> <sets>x<reps|seconds>s [each]",
// e.g. "split-squat 3x10 each" or "side-plank 3x30s each".
// `image` is an id in free-exercise-db (public domain, github.com/yuhonas/free-exercise-db);
// null where the dataset has no matching photo. Keep in sync with web/lib/exercises.ts.

export interface Exercise {
  id: string;
  name: string;
  kind: "strength" | "mobility";
  image: string | null;
}

export const EXERCISES: Exercise[] = [
  { id: "calf-raise", name: "Single-leg calf raise", kind: "strength", image: null },
  { id: "step-down", name: "Slow step-down", kind: "strength", image: null },
  { id: "split-squat", name: "Split squat", kind: "strength", image: "Split_Squats" },
  { id: "squat", name: "Bodyweight squat", kind: "strength", image: "Bodyweight_Squat" },
  { id: "walking-lunge", name: "Walking lunge", kind: "strength", image: "Bodyweight_Walking_Lunge" },
  { id: "step-up", name: "Step-up with knee drive", kind: "strength", image: "Step-up_with_Knee_Raise" },
  { id: "glute-bridge", name: "Single-leg glute bridge", kind: "strength", image: "Single_Leg_Glute_Bridge" },
  { id: "monster-walk", name: "Band monster walk", kind: "strength", image: "Monster_Walk" },
  { id: "plank", name: "Plank", kind: "strength", image: "Plank" },
  { id: "side-plank", name: "Side plank", kind: "strength", image: "Side_Bridge" },
  { id: "dead-bug", name: "Dead bug", kind: "strength", image: "Dead_Bug" },
  { id: "single-leg-balance", name: "Single-leg balance", kind: "mobility", image: null },
  { id: "ankle-circles", name: "Ankle circles", kind: "mobility", image: "Ankle_Circles" },
  { id: "calf-stretch", name: "Calf stretch", kind: "mobility", image: "Calf_Stretch_Hands_Against_Wall" },
  { id: "hamstring-stretch", name: "Hamstring stretch", kind: "mobility", image: "Hamstring_Stretch" },
  { id: "hip-flexor-stretch", name: "Hip flexor stretch", kind: "mobility", image: "Kneeling_Hip_Flexor" },
  { id: "quad-stretch", name: "Quad stretch", kind: "mobility", image: "Quad_Stretch" },
  { id: "it-band-stretch", name: "IT band & glute stretch", kind: "mobility", image: "IT_Band_and_Glute_Stretch" },
  { id: "glute-stretch", name: "Lying glute stretch", kind: "mobility", image: "Lying_Glute" },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** "<id> 3x10 each" | "<id> 3x30s" */
const LINE = /^([a-z-]+) (\d{1,2})x(\d{1,3})(s?)( each)?$/;

export interface Prescription {
  exercise: Exercise;
  sets: number;
  amount: number;
  unit: "reps" | "s";
  eachSide: boolean;
}

export function parseExerciseLine(line: string): Prescription | null {
  const m = line.trim().match(LINE);
  const exercise = m && BY_ID.get(m[1]);
  if (!m || !exercise) return null;
  return { exercise, sets: Number(m[2]), amount: Number(m[3]), unit: m[4] ? "s" : "reps", eachSide: !!m[5] };
}

/** Readable form for the watch calendar: "Split squat 3 x 10 each side". */
export function readableExercise(p: Prescription): string {
  return `${p.exercise.name} ${p.sets} x ${p.amount}${p.unit === "s" ? " s" : ""}${p.eachSide ? " each side" : ""}`;
}
