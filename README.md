# MUT 60 Coach

Adaptive training plans for two runners targeting **MUT 60 by UTMB**: 58 km / 3,005 m+, George, South Africa, Saturday 29 May 2027.

Watch (Garmin / COROS) → **intervals.icu** → this app → **Claude** adjusts the plan → workouts pushed back to intervals.icu → watch.

## How the plan stays trustworthy

1. **Fixed backbone (code).** `functions/src/engine/skeleton.ts` builds the season: base → build → peak → taper → race. It sets weekly km, climbing and long-run targets from your synced history, with no questionnaire. Growth is capped at 10%/week, there's a cutback every 4th week, the plan peaks around 70 km/week, and a ~36 km race simulation comes 4 weeks out. No training run is ever 60 km or more. Evidence: `docs/training-research.md`.
2. **Coach (Claude).** Every Sunday at 18:00, Claude plans next week's sessions from your synced data: activities, HR, HRV, resting HR, sleep, VO2 max, fitness/fatigue, and planned vs. done. Every morning at 05:00 a readiness check runs. If HRV, resting HR or sleep is off your own baseline and a hard day is coming, Claude reshuffles the rest of the week; this check can only *reduce* load.
3. **Guardrails (code).** `functions/src/engine/guardrails.ts` checks every proposal: weekly volume is within +5% of the plan and capped by what you actually ran recently. It also limits long-run size, allows max 2 hard sessions, never two hard days in a row, never a hard day before the long run, and requires a rest day. A rejected plan gets one retry with the errors; after that the deterministic template week is used instead.
4. **Rebase.** Two weeks under 60% of plan (illness, injury, life) rebuilds the remaining season from your current level instead of jumping back to old targets.
5. **Audit trail.** Every change is logged with its reason in Firestore (`athletes/{uid}/adjustments`). It isn't shown in the app.

Data privacy: each runner's plan and daily data are readable only by that runner (`firestore.rules`). Only the headline numbers in `stats/{uid}` are shared for the Compare page. The intervals.icu API keys live in `private/{uid}`, which no client can read.

> Strava is deliberately not used. Since June 2026 Strava's API policy forbids putting Strava data into an AI model's context. Connect your watch to intervals.icu directly. Activities that arrive only via Strava are skipped, and the app flags them.

## Layout

```text
functions/   Cloud Functions (TypeScript): sync, planning, Claude, guardrails
  src/engine/   pure logic + tests (skeleton, templates, guardrails, readiness, stats)
  src/coach/    Claude prompt/client and the Firestore orchestration
web/         Next.js static app (Firebase Hosting), installable on iPhone home screen
```

## Setup (one-time)

1. **Firebase project.** Create one at console.firebase.google.com and upgrade to the **Blaze** plan; scheduled functions and secrets require it. At two users, usage should stay within the free tier.
   - Authentication → enable **Google** sign-in.
   - Firestore → create a database (e.g. `africa-south1`).
   - Project settings → add a **Web app**, and copy its config.
2. **Local config**

   ```bash
   npm i -g firebase-tools && firebase login
   firebase use --add                                     # pick your project
   echo 'ALLOWED_EMAILS=you@gmail.com,friend@gmail.com' > functions/.env
   firebase functions:secrets:set ANTHROPIC_API_KEY       # from console.anthropic.com
   cp web/.env.example web/.env.local                     # fill in the web app config
   ```

3. **Deploy**

   ```bash
   (cd functions && npm install) && (cd web && npm install)
   firebase deploy
   ```

4. **Each runner**
   - Create an intervals.icu account. Under Settings → Connections, connect Garmin or COROS and allow planned-workout upload.
   - Under Settings → Developer Settings, copy your Athlete ID and create an API key.
   - Open the app, sign in with Google, and fill in the setup form. Your first week is planned immediately.
   - On iPhone: Safari → Share → **Add to Home Screen**.

## Develop

```bash
cd functions && npm test     # 33 tests: engine + end-to-end service flow with fakes
cd web && npm run dev        # needs web/.env.local
```

## Cost

Claude (`claude-opus-5-5`, adaptive thinking, effort `high`) runs once a week per runner, plus on mornings with a recovery flag. Expect roughly $5/month for two runners. That's an estimate; check the Anthropic console after the first few weeks. Requests opt into server-side refusal fallbacks (`fallbacks: "default"`).
