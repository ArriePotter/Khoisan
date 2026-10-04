// Turns intervals.icu workout text ("- 15m Z2 HR", "6x", ...) into one short,
// plain-language line. Anything that isn't a step (old headers, prose) is dropped.

const ZONE: Record<string, string> = {
  Z1: "very easy",
  Z2: "easy",
  "Z1-Z2": "easy",
  Z3: "steady",
  "Z2-Z3": "steady",
  Z4: "hard",
  "Z3-Z4": "hard",
  Z5: "sprint",
  "Z4-Z5": "very hard",
};

function amount(raw: string): string {
  const m = raw.match(/^(\d+(?:\.\d+)?)(km|m|s|h)(?:(\d+)s)?$/);
  if (!m) return raw;
  const [, n, unit, extraSec] = m;
  if (unit === "km") return `${n} km`;
  if (unit === "h") return `${n} h`;
  if (unit === "s") return `${n} s`;
  return extraSec ? `${n}:${extraSec.padStart(2, "0")} min` : `${n} min`;
}

function step(line: string): string {
  const [qty, ...rest] = line.replace(/^-\s*/, "").split(/\s+/);
  const words = rest.filter((w) => w !== "HR" && w !== "Pace" && w !== "Power");
  const zone = words.find((w) => /^Z\d(-Z\d)?$/.test(w));
  const extra = words.filter((w) => w !== zone).join(" ");
  return [amount(qty), zone ? ZONE[zone] ?? zone : "", extra].filter(Boolean).join(" ");
}

/** Workout steps as separate lines, e.g. ["15 min easy", "6× 3 min hard / 2 min very easy", "10 min very easy"]. */
export function stepList(description: string): string[] {
  const parts: string[] = [];
  let repeat: { times: string; steps: string[] } | null = null;
  const flush = () => {
    if (repeat) parts.push(`${repeat.times}× ${repeat.steps.join(" / ")}`);
    repeat = null;
  };
  for (const raw of description.split("\n")) {
    const line = raw.trim();
    const rep = line.match(/^(?:.*\s)?(\d+)x$/i);
    if (rep) {
      flush();
      repeat = { times: rep[1], steps: [] };
    } else if (line.startsWith("- ")) {
      if (repeat) repeat.steps.push(step(line));
      else parts.push(step(line));
    } else if (!line) {
      flush();
    }
  }
  flush();
  return parts;
}

export function summarizeSteps(description: string): string {
  return stepList(description).join(" → ");
}

/** Strength/mobility sessions list exercises one per line. */
export function exerciseList(description: string): string[] {
  return description
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter((l) => l && !/\bZ\d\b/.test(l)); // older plans wrote HR steps here
}
