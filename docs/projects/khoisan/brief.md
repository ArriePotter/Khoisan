# Brief: Project Khoisān, round 1

- **Owner:** Arno van Heerden (Design Lead)
- **Phase:** 0, Brief
- **Status:** In review
- **Last updated:** 2026-10-04
- **Note:** drafted by Claude from Arno's Phase 0 answers (given one question at a time, each critiqued and confirmed). Arno reviews, corrects and approves it.

## 1. Problem

When I open the app on my phone, I feel overwhelmed: everything competes for attention, and I don't know where to start reading. What I actually need in that moment is to know what today's session is, and right now I have to dig for it.

This happens **in the morning of a training day**, ahead of time: a short planning moment, not a glance five minutes before the run.

*Evidence:* my own use of the baseline app (commit `eb70f36`), n = 1. Daan hasn't been asked yet.

## 2. Audience

Two experienced trail runners, Arno (Garmin) and Daan (COROS), preparing for their first serious trail ultra. They're used to other running apps. Because the event demands it, they want to follow the plan strictly without second-guessing it, but they haven't had a chance to build trust in an AI-adjusted plan yet.

*Daan's side is Arno's assumption until Daan confirms it in Discover.*

## 3. Goal

By race day (MUT 60, 29 May 2027), Arno and Daan arrive prepared, and the app was the one place they used to understand and follow their training and to track their progress. It has failed if they reach the start line unprepared, or if they had to rely on other tools to know what to do.

**Guiding principle:** we focus on our running, not on navigating the app. Today's session comes first; progress data comes second.

## 4. Success metrics

Framework: Google HEART with Goals → Signals → Metrics (portfolio `docs/sources.md`, Product strategy).

| Category | Signal | Target | How it's measured |
|---|---|---|---|
| **Task success** (primary) | Finding today's session on opening | Each of us can say what today's session is within ~10 s of opening the app | Timed morning check, run on the baseline now and on the redesign in Validate |
| **Happiness: trust** (primary) | Willingness to follow the plan without second-guessing | A monthly 1–5 trust rating from each of us that rises over the season | Short monthly check-in; first rating taken on the baseline |
| **Engagement** (secondary) | Deliberate visits to progress data | Target and method set in Define | To decide in Define (no analytics today) |

**Real-world outcome** (reported honestly, not claimed as design success): we finish MUT 60 inside the 15 h cutoff, uninjured, and the race isn't a surprise because training felt like it. A target time gets set later, from data. Preparation depends on more than the app, so this shows whether the *training* worked, not whether the *design* did.

## 5. Appetite

- **Time box:** 3 weeks. The first redesigned version is live on both phones by **25 Oct 2026**.
- **Why short:** the training season is already running, so every week on the baseline is a week of training with the overwhelming version.
- **Arno's hours** go to direction, research with Daan and gate approvals. They come out of the portfolio's ~12 h/week, not on top of it.
- **When time runs out:** scope shrinks; the date doesn't move.

## 6. Scope of round 1

### In scope

- **Today's session screen:** what to do today, understood at a glance.
- **Why the plan changed:** show the reasons the coach already logs (`athletes/{uid}/adjustments`) in a form runners trust.
- **Minimal back-end work** to expose that existing log to the app.
- **Sign-in and onboarding:** Daan hasn't signed up yet, so Daan's first run is a real first-time-user test.

### Non-goals

- No stats or progress area (backlog).
- No predicted finish time (backlog; it's a feature, not a metric).
- No race-craft tips and tricks (backlog).
- No change to how the plan is generated: the engine, guardrails and coach logic stay as they are.
- No native app; it stays an installable web app.
- No users beyond Arno and Daan.

### Quality bar

- WCAG 2.2 AA, in Figma and in code.
- Every screen has its states designed: loading, empty, error, not-yet-synced and ideal.
- The `design-critic` design-review gate and `qa-auditor` code review pass before release.
- Every non-obvious choice has a decision record.

## 7. Roles and AI

Claude makes the Figma work and the code; Arno is the Design Lead who frames the problem, runs the research with Daan, chooses between directions and approves every gate (decision 0002). The case study labels the work as AI-assisted and states this split specifically.

## 8. Constraints

- **Stack:** Next.js 16 static export on Firebase Hosting, with Cloud Functions, Firestore and Google sign-in (see `CLAUDE.md`).
- **Platform:** phone first, used as an installable web app on the home screen.
- **Data path:** watch → intervals.icu → app. Garmin and COROS both have to work. Strava is excluded by its API policy.
- **Privacy:** POPIA. Training, health and wellness data never goes in git, and Daan's research participation needs Daan's consent.
- **Tools:** Figma Professional, team "Arno's Team".

## 9. Risks & assumptions

| # | Assumption | Risk if wrong | How we'll test it |
|---|---|---|---|
| 1 | Explanations based on our own data build trust ("you slept 2 hours, so the 10 km long run is now an easy 5 km") | We follow the plan less, or argue with it | Test the explanation patterns with both runners in Validate; track the trust rating |
| 2 | Arno's experience stands for both users | The design fits Arno only | Daan's sign-up and interviews in Discover; treat Arno's view as one data point |
| 3 | Daan is available and consents to being a research participant | No second user's evidence | Ask for consent at the start of Discover (anonymised as P2) |
| 4 | Onboarding can be made smooth despite intervals.icu's Athlete ID and API key steps | Daan gets stuck before seeing any value | Observe Daan's real sign-up |
| 5 | 3 weeks is enough for research, directions, review and build | Rushed quality or a slipped date | Arno's call: accepted. Cut scope before moving the date |
| **6** | **Watch data reaches intervals.icu, and then the app, reliably and on time, for both Garmin and COROS** | **The today screen shows wrong or missing sessions, and the design gets blamed. This is the riskiest assumption** | **Test first in Discover:** check sync timing and gaps for both watches; design explicit not-yet-synced states |

## 10. Parking lot

- Stats / progress area, as a deliberate, separate place to explore (Arno's idea; navigation is decided in Explore).
- AI-predicted finish time, once desk research shows how accurate trail-race prediction can be.
- Race-craft tips and tricks (pacing, fuelling, descending).
- The README's test count (33) is out of date: there are 60 tests.

## Sign-off

- [x] All sections complete
- [ ] Reviewed and corrected by Arno
- [ ] Approved by Arno (gate)
