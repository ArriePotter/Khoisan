# Insights: Discover, round 1

- **Date:** 2026-10-04
- **Evidence base:** P1 baseline check and sync check (`log.md`), desk research (`desk/today-and-explanations.md`). P2's sessions moved to Validate (decision 0004).
- **Caveat:** P1 is also the designer. Every user insight is "1 of 1" and stays a hypothesis until P2 confirms it.
- **Status:** Awaiting Arno's acceptance at the insight readout (gate)

## 1. Today's session is there, but it's buried

The runner finds the *type* of session quickly, but has to confirm it's for today and re-read the details, while other controls compete for attention.

- **Evidence:** P1 took **14 s** (pass with difficulty) against a ~10 s target. "Took a moment to confirm it is for today." The distance, climb and duration "took a while to take in", and the guidance had to be read again. Garmin, which P1 uses, presents one suggested workout a day with a single do-or-dismiss choice (tier 3).
- **Frequency:** 1 of 1 runner observed.
- **So what:** the today screen needs an unmistakable "today", the session's key numbers in a scannable order, and everything else moved out of the first view.

## 2. An easier session without a visible reason lowers trust

When the plan gives a lighter session and doesn't say why, the runner suspects they're under-preparing.

- **Evidence:** P1 trust **2.5 / 5**: "a 2 km easy run seems a bit like I am not preparing enough". P1's own hypothesis: a reason backed by the runner's own data would be trusted. Google PAIR recommends short, data-based explanations shown at the moment of the change (tier 3). The reasons already exist in the app's adjustments log, and rule-based ones are built directly from data.
- **Frequency:** 1 of 1 runner observed.
- **So what:** show the reason for a changed or lighter session next to the session, led by the runner's own data (rule-based reason first), short enough to read in the morning moment.

## 3. Controls with unclear consequences make the plan feel unstable

Buttons whose effect isn't obvious make the runner wonder whether the plan they just read is about to change.

- **Evidence:** P1 on "Re-plan week": "if I press that will my day's plan that I just read change?" "Sync now", "Recovery" and "Re-plan week" all pulled attention during the baseline. NN/g warns that unclear AI behaviour drives either over-trust or doubt (tier 4).
- **Frequency:** 1 of 1 runner observed.
- **So what:** the morning view shouldn't offer actions that can change the plan without saying what they'll do. Rare actions like re-planning move away from the today view, and any action that changes the plan states its effect before it runs.

## Open questions for Validate (P2)

- Does a COROS user expect a fixed calendar plan, and does an overnight change surprise them more? (desk finding 2)
- Can P2 sign up and connect intervals.icu without help? (brief risk 4)
- Does COROS data sync reliably? (decision 0003)
