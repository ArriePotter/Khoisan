# 0005: Today screen = week strip + today card, with one visible reason line

- **Date:** 2026-10-04
- **Status:** Accepted
- **Department:** Interaction design
- **Phase:** Explore
- **Decided by:** Arno
- **Figma:** [💡 Explorations](https://www.figma.com/design/plcCxrmXnhvGsqFi5dH1bD), section "Chosen · Week strip + today card"

## Context

The Today screen has to answer "what's my session?" in ≤ 10 s (J1), explain why the session is what it is (J2), and keep plan-changing actions predictable (J5). Three greyscale directions were built with the same scenario (8 km steady softened to a 2 km recovery run after short sleep and low HRV) and critiqued by the `design-critic` agent.

## Options considered

1. **A · One card.** The session leads, with 3-column numbers and the reason next to it. *Not chosen alone:* it never says the plan changed.
2. **B · Reason first.** The coach's call and three "vs normal" metrics lead. *Not chosen:* the reason outranks the session, against the brief's principle "today's session comes first", and the coach voice reads as interpretation, not data (NN/g).
3. **C · Today in the week.** A week strip on top, with the change shown as before → after. *Not chosen alone:* the strip competed with today. Before → after assumes the runner knew the old plan.
4. **Hybrid** (chosen, below).

The critic noted that A and C share one layout, so these were "2.5 directions". It recommended building on A.

## Decision

Top to bottom:

- **Week strip** from C, as **status only**: ticks for done days, today marked. Tapping a day doesn't change the view.
- **Today card** from A: label "TODAY · effort", the title, distance / climb / time in 3 columns, **one visible reason line plus "See why ›"**, the **first guidance line plus "Full session ›"**, and "✓ On your watch".
- **"Tomorrow:"** from C.
- A **⋯ menu** where every action states its effect ("Re-plan this week: today's session may change").

## Evidence

- Session first, reason beside it: brief guiding principle; insights 1–2; Google PAIR (explain at the moment the result is seen).
- Visible reason line, not link-only: P1's trust fell to 2.5 *without* knowing anything had changed (insight 2). Arno first proposed link-only; Claude pushed back, and Arno confirmed the visible line. Link-only remains a Validate variant.
- No before → after: Arno's point that the runner may never have seen the old plan (*judgement*).
- Week strip for habit: Arno's hypothesis that seeing ticks builds consistency (*judgement*, untested).
- First guidance line only: Arno judged the generic lines ("skip it if you feel run down") as low value. The guidance field holds the full workout on structured days, so it collapses rather than being deleted.

## Consequences

- Easier: one clear reading order (week → today → tomorrow).
- Harder: the strip must never imply navigation; days need full accessible names and non-colour "today" marking (WCAG 1.4.1).
- To test in Validate: (1) does the strip help or distract on opening; (2) one-line reason vs link-only; (3) is the first guidance line enough; (4) does P2 (COROS) accept an overnight change from this screen.
- Next: design all states (rest day, not yet synced, no reason logged, loading, error) for the chosen direction.

## Case-study note

I combined the strongest parts of three directions, and kept the one reason line visible against my own first instinct, because my research showed trust drops when the why is hidden.
