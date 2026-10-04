# 0003: Accept the sync risk on partial evidence and design for failure

- **Date:** 2026-10-04
- **Status:** Accepted
- **Department:** UX research
- **Phase:** Discover
- **Decided by:** Arno

## Context

The brief names watch-data sync (watch → intervals.icu → app) as the riskiest assumption. The research plan had a 7-day sync log for both watches. The round has a 3-week appetite, and the log would take a week of it.

## Options considered

1. **Run the full 7-day log for Garmin and COROS.** Pros: strong evidence. Cons: a week of the 3-week round; COROS can't start until P2 signs up.
2. **Accept the risk on the evidence we have, and design for sync failure.** Pros: keeps the date. Cons: COROS stays untested for now.

## Decision

Treat sync as reliable enough to proceed, based on P1's two most recent Garmin activities syncing correctly. Mitigate by designing explicit "not yet synced" and "missing data" states, and check COROS passively through P2's first workouts after sign-up.

## Evidence

- 2 of 2 recent Garmin activities synced with reliable data (P1, self-reported).
- No COROS evidence yet.

## Consequences

- Easier: Discover stays inside the timebox.
- Harder: if COROS sync proves unreliable, the today screen may show stale sessions for P2. The designed sync states limit the damage, but the fix may lie outside design (in the intervals.icu connection).
- Revisit after P2's first week of workouts.

## Case-study note

I traded a week of sync testing for time, but designed for the failure case so the trade couldn't break the product.
