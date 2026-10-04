import Anthropic from "@anthropic-ai/sdk";
import { initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";
import { DEFAULT_TIMEZONE } from "./config";
import { connectAthlete, listAthleteIds, morningCheck, planAhead, planWeek, rebuildPlan, recomputeStats, syncAthlete } from "./coach/service";
import { addDays, localToday, mondayOf } from "./dates";

initializeApp();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const ALLOWED_EMAILS = defineString("ALLOWED_EMAILS", {
  description: "Comma-separated emails allowed to use the app (you and your training partner).",
});

const anthropic = () => new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

function requireMember(req: CallableRequest): { uid: string; email: string } {
  const email = req.auth?.token.email?.toLowerCase();
  if (!req.auth || !email) throw new HttpsError("unauthenticated", "Sign in first.");
  const allowed = ALLOWED_EMAILS.value()
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(email)) throw new HttpsError("permission-denied", "This account is not on the team.");
  return { uid: req.auth.uid, email };
}

async function forEachAthlete(job: string, fn: (uid: string) => Promise<unknown>) {
  for (const uid of await listAthleteIds()) {
    try {
      await fn(uid);
    } catch (err) {
      logger.error(`${job} failed`, { uid, err: String(err) });
    }
  }
}

const heavy = { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 540, memory: "512MiB" as const };

const ConnectInput = z.object({
  displayName: z.string().trim().min(1).max(40),
  intervalsAthleteId: z.string().trim().regex(/^i?\d+$/, "Athlete ID looks like i123456"),
  intervalsApiKey: z.string().trim().min(10),
  timezone: z.string().optional(),
  notes: z.string().max(1000).optional(),
  availability: z
    .object({
      trainingDays: z.array(z.number().int().min(0).max(6)).min(3, "Pick at least 3 training days").max(6, "Keep at least one rest day"),
      longRunDay: z.number().int().min(0).max(6),
    })
    .refine((a) => new Set(a.trainingDays).size === a.trainingDays.length, "Duplicate training days")
    .refine((a) => a.trainingDays.includes(a.longRunDay), "The long-run day must be one of your training days"),
});

export const connect = onCall(heavy, async (req) => {
  const { uid, email } = requireMember(req);
  const parsed = ConnectInput.safeParse(req.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((i) => i.message).join("; "));
  try {
    await connectAthlete(uid, email, parsed.data, anthropic());
  } catch (err) {
    logger.error("connect failed", { uid, err: String(err) });
    if (String(err).includes("intervals.icu GET")) {
      throw new HttpsError("failed-precondition", "Could not reach intervals.icu with that athlete ID and API key.");
    }
    throw new HttpsError("internal", "Setup failed. Check the function logs.");
  }
  return { ok: true };
});

export const syncNow = onCall({ timeoutSeconds: 300 }, async (req) => {
  const { uid } = requireMember(req);
  const result = await syncAthlete(uid);
  await recomputeStats(uid);
  return result;
});

export const replanNow = onCall(heavy, async (req) => {
  const { uid } = requireMember(req);
  const today = localToday(DEFAULT_TIMEZONE);
  const { source, proposal } = await planWeek(uid, mondayOf(today), { fromDate: today, kind: "manual" }, anthropic());
  return { source, rationale: proposal.rationale };
});

export const rebuildPlanNow = onCall(heavy, async (req) => {
  const { uid } = requireMember(req);
  const baseline = await rebuildPlan(uid, anthropic());
  return { baseline };
});

export const scheduledSync = onSchedule({ schedule: "every 2 hours", timeZone: DEFAULT_TIMEZONE, timeoutSeconds: 540 }, async () => {
  await forEachAthlete("sync", async (uid) => {
    await syncAthlete(uid);
    await recomputeStats(uid);
  });
});

export const morningReadiness = onSchedule({ schedule: "0 5 * * *", timeZone: DEFAULT_TIMEZONE, ...heavy }, async () => {
  await forEachAthlete("morning check", (uid) => morningCheck(uid, anthropic()));
});

export const weeklyPlanner = onSchedule({ schedule: "0 18 * * 0", timeZone: DEFAULT_TIMEZONE, ...heavy }, async () => {
  const nextWeek = addDays(mondayOf(localToday(DEFAULT_TIMEZONE)), 7);
  await forEachAthlete("weekly plan", async (uid) => {
    await syncAthlete(uid);
    await planAhead(uid, nextWeek, "weekly", anthropic());
    await recomputeStats(uid);
  });
});
