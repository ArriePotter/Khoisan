# Define: Project Khoisān, round 1

- **Phase:** 2, Define (product strategy + interaction design)
- **Inputs:** [brief](brief.md), [insights](../../research/insights.md), [desk research](../../research/desk/today-and-explanations.md)
- **Status:** Scope signed off by Arno (Define gate passed 2026-10-04)
- **Last updated:** 2026-10-04

## 1. Problem statement

On a training morning, a runner opens the app to find out what today's session is. Today's session is on screen, but it shares the first view with about 20 other blocks (6 charts, 4 stat tiles, a 4-tab week view, recovery metrics, warnings and two plan-changing buttons). The runner needs ~14 s to be sure of the session, has to re-read its details, and can't see *why* the session is what it is. The reason exists, but it sits in a separate card, or isn't shown at all. That costs time and, more importantly, trust: a lighter session without a visible reason reads as under-preparing.

## 2. Job stories

| # | Job story | From |
|---|---|---|
| J1 | **When** I open the app on a training morning, **I want to** know today's session at a glance, **so I can** plan my day around it. | Insight 1 |
| J2 | **When** today's session is different from what I expected (lighter, shorter, moved), **I want to** see why, based on my own data, **so I can** follow it without second-guessing. | Insight 2 |
| J3 | **When** I'm getting ready for the session, **I want to** read its key numbers and guidance in a scannable order, **so I can** do it as intended. | Insight 1 |
| J4 | **When** my latest workout or last night's sleep hasn't synced yet, **I want to** know the plan may not reflect it, **so I** don't act on stale information. | Decision 0003 |
| J5 | **When** I deliberately want to re-plan or sync, **I want to** know what will happen before it happens, **so I** don't lose the plan I just read. | Insight 3 |
| J6 | **When** I sign up for the first time, **I want to** connect my watch data without getting stuck, **so I can** see my first plan quickly. | Brief risk 4 |

## 3. Scope

### Screens in scope

| Screen | Jobs | What changes |
|---|---|---|
| **Today** (home) | J1–J5 | Redesigned around today's session and its reason |
| **Sign-in** | J6 | Redesigned as the first impression |
| **Onboarding** (setup) | J6 | Redesigned to make the intervals.icu connection steps followable |

### Out of scope (from the brief)

- Plan, Personal and Compare pages: not redesigned.
- The stats, charts and week tabs now on Today: **moved off the first view unchanged**, not redesigned. Where they go is decided in Explore (IA).
- How plans are generated: no change. The app only *shows* reasons that are already logged.

### Back-end work allowed

Read access in the app to the existing adjustments log (`athletes/{uid}/adjustments`: `kind`, `source`, `readiness`, `rationale`) and the week's existing `rationale` field. No new logic.

## 4. Success criteria (checked in Validate)

| Criterion | Target | Method |
|---|---|---|
| Find today's session (J1) | P1 and P2 each ≤ 10 s, pass (P1 baseline: 14 s, pass with difficulty) | Timed morning check on the redesign |
| Understand a change (J2) | Both can say *why* today's session is what it is, in their own words, without prompting | Scenario task with a changed session |
| Trust (J2) | P1 above the 2.5 baseline; P2's first rating recorded | 1–5 rating after the scenario |
| Predictable actions (J5) | Both can say what "re-plan" will do before pressing it | Question during the test |
| Onboarding (J6) | P2 connects intervals.icu and reaches the first plan without help | Observed first sign-up (decision 0004) |
| Accessibility | WCAG 2.2 AA on all three screens | `design-critic` review and `qa-auditor` check |

## 5. Content inventory: Today (current)

Priority uses MoSCoW for the **first view** of the redesign: **Must** be seen first, **Should** be reachable from Today, **Could** live elsewhere.

| Content | Current location | Priority | Why |
|---|---|---|---|
| "Today" + the date | Inside the session row | **Must** | J1; P1 had to confirm it was today |
| Session title and type (e.g. recovery run) | Today card | **Must** | J1 |
| Key numbers: distance, climbing, duration, effort | Today card | **Must** | J3; read twice in the baseline |
| Session guidance (steps, "walk if HR climbs") | Today card | **Must** | J3 |
| Reason for today's session (readiness reasons; adjustment rationale) | Separate Recovery card / not shown | **Must** | J2, insight 2 |
| Sync freshness (last sync; "sleep hasn't come through") | Recovery card (sleep only) | **Must** when stale | J4 |
| Warnings: heart-rate data unreliable; Strava-only activities | Banners above Today | **Should** | They change how to run the session, but not every day |
| Readiness level and metrics (HRV, resting HR, sleep) | Recovery card | **Should** | Evidence for the reason; detail on demand |
| Phase and week ("Build phase · week 6 of 34") | Header | **Should** | Context, not the task |
| Race countdown | Nav header | **Should** | Motivation; low cost |
| This week's other sessions | Week tabs | **Should** | Planning ahead |
| "Sync now" | Header button | **Could** | Rare; J5 |
| "Re-plan week" | Header button | **Could** | Rare and plan-changing; J5, insight 3 |
| Next weeks' tabs (next, in 2, in 3 weeks) | Week tabs | **Could** | Planning, not the morning task |
| 4 stat tiles (7-day km, VO2 max, easy share, descent) | Grid | **Could** | Stats area (backlog) |
| 6 charts (distance, climbing, descent, HRV, sleep, VO2 max) | Grid | **Could** | Stats area (backlog) |
| Greeting "Hi {name}" | Header | **Could** | Takes the most prominent spot without helping the task |

### Sign-in and onboarding inventory

- **Sign-in:** app name, race summary (MUT 60 · 58 km · 3,005 m+ · George · 29 May 2027), "Sign in with Google", error message.
- **Onboarding:** intro (goal, how data flows), step 1 "Connect intervals.icu" (3 instructions, name, Athlete ID, API key), step 2 "Your week" (training days, long-run day, notes), validation messages, "Build my plan", progress text ("takes a minute or two").

## 6. States to design (per screen)

| Screen | Ideal | Empty | Loading | Partial | Error |
|---|---|---|---|---|---|
| Today | Session + reason | Rest day; no session planned | Data loading | Not yet synced; no reason logged; HR unreliable | Sync or load failed |
| Sign-in | Ready | — | Signing in | — | Not on the allowed list; sign-in failed |
| Onboarding | Form ready | — | Building the plan (1–2 min) | Some steps done | Wrong Athlete ID or API key; fewer than 3 days; no long-run day |

## Sign-off

- [x] All sections complete
- [x] Scope signed off by Arno (gate), 2026-10-04
