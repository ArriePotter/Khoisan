# Desk research: "today's session" and explaining plan changes

- **Date:** 2026-10-04
- **Questions:** research plan Q4 (trust) and Q5 (mental models)
- **Tiers** follow the portfolio's `docs/sources.md`: 3 = platform owners, 4 = NN/g, 5 = practitioners/blogs, 6 = blogs/AI (hypotheses only).

## Findings

### 1. Garmin presents one suggested workout a day, with a clear do-or-dismiss choice (tier 3)

Garmin's Daily Suggested Workouts are "recommended based on your training history, VO2 max., sleep, and recovery time". The suggestion "updates automatically to changes in training habits, recovery time, and VO2 max", and the runner either selects **Do Workout** or **Dismiss**. ([Forerunner 55 manual](https://www8.garmin.com/manuals/webhelp/GUID-3A791586-B59F-4B37-B9C5-5A41F8C6BE0B/EN-US/GUID-3E98F0F7-8B88-46FC-9F82-61EB6ECEC628.html), [Forerunner 970 manual](https://www8.garmin.com/manuals/webhelp/GUID-025D75CF-3445-49E1-8D81-1AA74AB4E00F/EN-US/GUID-542FB2A1-D6D2-4C77-8573-65E87182BFAD.html))

The manuals don't show how the reason is worded on screen. A reviewer reports rest or recovery suggestions after poor sleep or rising load ([the5krunner](https://the5krunner.com/garmin-features/training/daily-suggested-workouts/), tier 5, hypothesis only).

*So what:* P1 (Garmin) likely expects **one session a day with one obvious action**. The current app shows the session among several competing controls.

### 2. COROS is calendar- and metrics-led; adaptive behaviour isn't confirmed by COROS (tier 3)

COROS offers "structured workouts and training plans" through a Training Hub calendar. EvoLab uses training load "to calculate metrics like Base Fitness, Training Status, and Recovery Timer". The official page does not say that plans adapt to recovery or HRV. ([COROS Training Hub](https://www.coros.com/stories/coros-coaches/c/welcome-to-the-training-hub)) A third-party guide claims the COROS coach downgrades sessions after low HRV ([athletedata.health](https://www.athletedata.health/guides/coros-ai-coach), tier 6, unverified).

*So what:* P2 (COROS) may expect a **fixed calendar plan**, not a plan that changes daily. A changed session could surprise P2 more than P1. **Ask P2 in the interview.**

### 3. Explanations should help people calibrate trust, not trust blindly (tier 3)

Google's People + AI Guidebook: "the user shouldn't trust the system completely. Rather, based on system explanations, the user should know when to trust the system's predictions and when to apply their own judgement." Explain which data the system uses, so users know when "they have a critical piece of information that the system does not". Use **partial explanations** that "intentionally leave out parts of the system's function that are unknown, highly complex, or simply not useful". "The perfect time to show explanations is in response to a user's action." Its worked example is a running app. ([PAIR: Explainability + Trust](https://pair.withgoogle.com/chapter/explainability-trust/))

*So what:* show the **data behind a change** (for example, short sleep vs the runner's usual) briefly, at the moment the runner sees the changed session, and leave room for what the app can't know (for example, "I feel fine").

### 4. AI-written reasoning is often unfaithful, and its presence alone inflates trust (tier 4)

NN/g (Chan, Dec 2025): step-by-step AI reasoning is "often unfaithful" to how the model actually decided, and citations raise confidence even though "people rarely click citation links". Recommendations: put evidence "directly next to the specific claim", describe limitations in clear language, and avoid anthropomorphic, first-person phrasing. ([NN/g: Explainable AI in Chat Interfaces](https://www.nngroup.com/articles/explainable-ai/))

*So what:* see the code check below. The most faithful explanation is the one computed from rules and data, not the one an LLM wrote.

### 5. Academic studies: short, actionable explanations beat verbose ones; errors hurt trust regardless (hypothesis)

Preprints report that concise, actionable explanations are preferred over verbose technical ones, and that trust drops after visible errors however well they're explained. ([arXiv 2510.15769](https://arxiv.org/abs/2510.15769), [arXiv 2312.02034](https://arxiv.org/abs/2312.02034)) These are preprints, not replicated findings, so they count as hypotheses only.

## Code check: what the app already logs

Every plan change is written to `athletes/{uid}/adjustments` (`functions/src/coach/service.ts`) with:

- `kind` (`daily`, `rebase`, or the weekly plan)
- `source` (`rules`, `claude` or the template)
- `readiness` level, for daily checks
- `rationale`: either a **rule-built sentence from data** (for example, the readiness reasons, or "the last two weeks came in well under plan…") or **text written by Claude**

*So what:* the app can show **rule-based reasons first**, because they're faithful by construction, and treat Claude's rationale as secondary. The `source` field lets the design tell them apart. No change to how plans are made is needed (brief, non-goals).

## Hypotheses for Explore (to test in Validate)

1. **One session, one primary action.** The today screen shows the session and a single obvious action, with everything else moved away (findings 1, P1 baseline).
2. **Data-first, partial explanations.** A changed session shows a short reason built from the runner's own data, next to the change, at the moment it's seen (findings 3–4, P1 hypothesis "if the why is backed by our data it will be trusted").
3. **Faithful over fluent.** Rule-based reasons lead; AI-written text is secondary and never phrased as a person thinking (finding 4, code check).
4. **The calendar-vs-adaptive gap.** The first time a plan changes may need more explanation for a runner used to fixed calendars (finding 2, to confirm with P2).
