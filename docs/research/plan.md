# Research plan: Discover, round 1

- **Phase:** 1, Discover
- **Dates:** 5–11 Oct 2026; insights readout ~12 Oct
- **Brief:** [`docs/projects/khoisan/brief.md`](../projects/khoisan/brief.md)
- **Participants:** P1 (Arno, designer and user), P2 (second runner, COROS). P2 consented on 2026-10-04 (written, via message; the consent record is kept off-repo).

## Research questions

Ordered by the brief's risks, riskiest first.

1. **Sync (risk 6, riskiest):** Does each watch's data (Garmin, COROS) reach intervals.icu and then the app reliably? How long does it take, and what goes missing?
2. **The morning moment (problem):** On today's app, how long does each runner take to say what today's session is, and what gets in the way?
3. **Onboarding (risk 4):** Can P2 sign up and connect intervals.icu without help? Where do they get stuck?
4. **Trust (risk 1):** What makes each runner trust or doubt a training plan? Which past apps earned trust, and why?
5. **Mental models:** What have Garmin Connect, COROS and intervals.icu taught these runners to expect from "today" and from plan changes?

## Methods

| # | Method | Question | Who | When | Output |
|---|---|---|---|---|---|
| 1 | **Baseline check** on today's app: timed "what's today's session?" on opening, plus a 1–5 trust rating | 2, 4 | P1 now; P2 after sign-up | 5 Oct morning (P1) | Baseline numbers for the case study |
| 2 | **Observed sign-up**, think-aloud, with no help from Arno | 3 | P2 | When P2 is ready, ideally 5–6 Oct | Stuck points, time, pass / pass with difficulty / fail |
| 3 | **7-day sync log:** after each workout, note when it appeared in intervals.icu and in the app, and anything missing or wrong | 1 | P1 + P2 | 5–11 Oct | Sync times and gaps per watch |
| 4 | **Interview** (past behaviour, ~20 min) | 4, 5 | P2 (P1 answers in writing, flagged as designer-bias) | 7–9 Oct | Quotes and patterns |
| 5 | **Desk research:** how Garmin Connect, COROS and intervals.icu show today's session and explain adaptive changes | 5 | Claude | 5–9 Oct | Tiered sources (portfolio `docs/sources.md`) |

## Measures

- **Task success:** time to say today's session, and pass / pass with difficulty / fail.
- **Trust:** 1–5, "How much do you trust today's session to be right for you?"
- **Sync:** minutes from finishing a workout to it appearing in intervals.icu, and then in the app; count of missing or wrong activities.

## Ethics and data

- Written notes only, no recordings.
- Anonymised in this repo (P1, P2). Raw notes, consent and any real training values stay off-repo and are deleted after the case study is published.
- Health and wellness data (HRV, sleep, resting HR) is described as patterns, never pasted as values or screenshots.

## Limits

Two participants, one of whom is the designer. Findings describe these two runners, not trail runners in general, and counts are reported as "1 of 2", never as percentages.
