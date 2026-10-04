import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const app =
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

export const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app, process.env.NEXT_PUBLIC_FUNCTIONS_REGION || "us-central1");

export interface ConnectInput {
  displayName: string;
  intervalsAthleteId: string;
  intervalsApiKey: string;
  timezone?: string;
  notes?: string;
  /** 0 = Monday ... 6 = Sunday */
  availability: { trainingDays: number[]; longRunDay: number };
}

export const callConnect = httpsCallable<ConnectInput, { ok: boolean }>(functions, "connect", { timeout: 540_000 });
export const callSyncNow = httpsCallable<void, { activities: number; wellness: number; stravaOnly: number }>(functions, "syncNow", { timeout: 300_000 });
export const callReplanNow = httpsCallable<void, { source: string; rationale: string }>(functions, "replanNow", { timeout: 540_000 });
export const callRebuildPlan = httpsCallable<void, { baseline: { weeklyKm: number; longestRunKm: number } }>(functions, "rebuildPlanNow", { timeout: 540_000 });
