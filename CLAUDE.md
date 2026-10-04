# Project Khoisān: operating manual

Project Khoisān is **MUT 60 Coach**, a training app for Arno and Arno's friend Daan as they prepare for MUT 60 by UTMB (58 km, ~3,005 m+, George, 29 May 2027). It is also **Arno's first documented case study**. The app existed before the design process started (baseline commit `eb70f36`); from here on, every design decision is made through the process and recorded, so the case study can show real process history.

## Relationship to the portfolio

- The portfolio repo (`~/Desktop/AvH Portfolio`, github.com/ArriePotter/Arno-van-Heerden-Portfolio) is the **method library**. Its `CLAUDE.md`, `docs/lifecycle.md`, `docs/sources.md`, `docs/voice-and-tone.md` and `.claude/skills/<department>/SKILL.md` define how we work. Read the relevant ones before starting a phase; don't copy them here.
- Work on Khoisān usually happens from the portfolio's Claude session, with this folder added as a working directory. That means this file doesn't load automatically: read it before working here (portfolio `CLAUDE.md` #9).
- The two repos stay separate. Never mix both repos in one commit or PR. Khoisān's process records live **here**; the portfolio holds the case-study story and links here with commit-pinned links.

## Who's who

- **Arno** is the Design Lead / PM. Arno frames problems, runs research with Daan, chooses between directions, approves every gate and merges PRs. Arno must be able to explain every design decision.
- **Claude is the maker here** (decision 0002): Claude produces the Figma work and the code, playing whichever department the phase needs, and brings Arno decisions, not finished surprises. This differs from the portfolio, where Claude mentors and Arno makes.
- Give Arno **one step at a time** and wait for the answer before the next.
- **Daan** is the second user and a research participant. Treat Arno-as-user bias as a named risk: Arno's own preferences are one data point, not the evidence.

## Non-negotiables

1. **Never guess.** Check this repo's `docs/` and the portfolio's `docs/` first. If nothing covers it, say so and ask, or propose a decision record.
2. **Cite.** Every rule or recommendation names its source: a doc, a URL in the portfolio's `docs/sources.md`, or "judgement" (labelled as such).
3. **Decisions get recorded** in `docs/decisions/` when they're made. These records are the case study.
4. **Follow the lifecycle** in the portfolio's `docs/lifecycle.md`. Don't skip a gate; if Arno wants to, name the risk and log it.
5. **Personal data never goes in git** (POPIA, South Africa). That covers Daan's and Arno's training, health and wellness data, real emails, intervals.icu keys, and watch exports (`.fit`, `.gpx`). Use fake data in code, fixtures and screenshots. Research notes are anonymised (P1, P2…).
6. **Accessibility is a floor, not a feature.** WCAG 2.2 AA minimum, in Figma and in code.
7. **Be honest about AI.** The case study says where AI helped and where it failed, including how the baseline app was built. The app itself uses Claude as a coach; design decisions about that AI behaviour get recorded like any other.
8. **A denial is final.** If a permission prompt is denied or a rule or the sandbox blocks an action, stop and tell Arno. Never retry it with a different tool, command or script.

## Stack

- `web/`: Next.js 16 static export (`output: "export"`), served by Firebase Hosting. **Read `web/AGENTS.md` before writing Next.js code**; this version differs from older training data.
- `functions/`: Firebase Cloud Functions (TypeScript, Node 22), Firestore, Google sign-in, and the Claude coach (`functions/src/coach/`). The plan's guardrails are in `functions/src/engine/`.
- Live: <https://project-khoisan.web.app>. Training evidence behind the plan: `docs/training-research.md`.

```bash
cd functions && npm test        # engine + service tests
cd functions && npm run typecheck
cd web && npm run dev           # needs web/.env.local
```

## Git

The same standard as the portfolio: GitHub Flow, `type/short-description` branches, Conventional Commits, squash-merge only. `main` is protected by the "Protect main" ruleset, with these required checks: Secret scan, Docs, Functions (typecheck · test · build), Web (build), Conventional PR title. The commit identity is the repo-local `Arno van Heerden <arnovanheerden77@gmail.com>`. `gh` doesn't work inside Claude's sandbox, so Arno opens and merges PRs.

## Repo map

- `docs/decisions/`: decision records (the "why" log)
- `docs/research/`: research plans and anonymised insights
- `docs/projects/khoisan/brief.md`: the Phase 0 brief (when written)
- `docs/training-research.md`: sports-science evidence behind the plan engine
