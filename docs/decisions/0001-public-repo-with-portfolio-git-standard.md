# 0001: Public repo with the portfolio's git and quality standard

- **Date:** 2026-10-04
- **Status:** Accepted
- **Department:** Design engineering
- **Phase:** Brief (setup)
- **Decided by:** Arno

## Context

Project Khoisān is Arno's first documented case study. The app already existed as an untracked folder (git initialised, no commits) before any design process. For the case study to show real process history, every change from here on needs a traceable record. GitHub Free only enforces rulesets on public repos. The app handles personal training and health data for two people, which POPIA covers.

## Options considered

1. **Public repo, portfolio standard**: protected `main`, PRs, CI checks, Conventional Commits. Pros: free enforcement; hiring managers can verify the process. Cons: the code is visible; there's an ongoing duty to keep personal data out.
2. **Private repo**: Pros: nothing visible. Cons: no ruleset on GitHub Free; case-study links show a 404 to reviewers.
3. **No repo / folder only**: Pros: zero setup. Cons: no history, so the "no process history" gap the earlier projects have would repeat.

## Decision

Public repo `ArriePotter/Khoisan`, using the same git and quality standard as the portfolio repo, with checks adapted to this stack.

## Evidence

- GitHub rulesets are available on public repos for GitHub Free: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets> (listed in the portfolio's `docs/sources.md`).
- A pre-publish scan (4 Oct) found no commit history to clean, `.env` files ignored, server secrets in Firebase `defineSecret`, and no personal data in committable files. gitleaks reported no leaks.
- Being able to check the evidence is the point of documenting the process (*judgement*).

## Consequences

- Easier: every design change is a dated PR with checks, and the baseline `eb70f36` is a clean "before".
- Harder: personal data must never enter git, so the PR template has a personal-data check and `.gitignore` blocks watch exports and keys.
- Differences from the portfolio: no lint step yet (the web app has no ESLint), and the app checks are split into Functions and Web.
- Revisit if the app gains users beyond Arno and Daan.

## Case-study note

The case study starts from a tracked baseline, so every design decision after it can be shown and verified.
