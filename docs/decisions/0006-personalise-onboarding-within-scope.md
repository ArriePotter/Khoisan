# 0006: Personalise onboarding with guided coach notes and a visible starting point, not new fields

- **Date:** 2026-10-04
- **Status:** Accepted
- **Department:** Interaction design + product strategy
- **Phase:** Explore
- **Decided by:** Arno
- **Figma:** [🔀 Flows](https://www.figma.com/design/plcCxrmXnhvGsqFi5dH1bD), screens "4 Your week" and "5 Building your plan"

## Context

Arno asked whether onboarding should gather more information, for a more pleasant experience and a more personal plan from day one. The brief rules out changing how plans are generated in round 1. POPIA's minimality condition means collecting only personal data that is actually used. A code check showed the setup notes field already goes into the AI coach's planning context (`functions/src/coach/service.ts`).

## Options considered

1. **Add structured fields** (goal finish time, experience, weekday time limit, terrain). Pros: richer input. Cons: the engine ignores them, so this would be a false promise; needs engine changes (out of scope); collects data that isn't used (POPIA).
2. **Guided coach notes + show the computed starting point.** Pros: personalises through the existing notes, with no engine change, and the starting point builds trust. Cons: free text is less structured.
3. **Leave onboarding as it is.** Cons: a blank optional box gets skipped, and the plan feels generic.

## Decision

Option 2:

- **(a)** Tappable prompts on "When can you train?" ("+ Weekday time limit", "+ Hills near home?", "+ Injuries", "+ Gym access") fill the coach notes.
- **(b)** "Building your plan" shows "Your starting point: ~32 km a week · longest recent run 18 km", computed from intervals.icu history.
- **(c)** Structured fields are parked for round 2.

## Evidence

- Brief non-goals: no change to how plans are generated.
- POPIA minimality (portfolio `docs/sources.md`, standards tier).
- Code: the notes reach the coach; the baseline (weekly km, longest run) is already computed.
- Google PAIR: explain which data the system uses (desk finding 3).

## Consequences

- Easier: a personal first plan without back-end work, and an early trust moment.
- Harder: the coach's use of notes is free text, so we can't promise how strongly it weighs them.
- Revisit in round 2: goal finish time (pending trail-prediction research), experience, weekday limits.

## Case-study note

I personalised onboarding through data the system already used, instead of asking for data it would ignore.
