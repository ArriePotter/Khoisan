# 0009: Design review fixes, phone-only scope and decorative map labels

- **Date:** 2026-10-05
- **Status:** Accepted
- **Department:** Visual + interaction design
- **Phase:** Design (review gate)
- **Decided by:** Arno
- **Figma:** 🔀 Flows (Day + Night), 🧪 Prototype, ✅ Ready for dev

## Context

The `design-critic` design review (5 Oct) marked the Trailhead onboarding "Not ready" with 6 blockers: an incomplete Today card, a weak error state, a barely visible Night course line, small map labels below 4.5:1, no interactive states or components, and missing flow states.

## Decision

1. **Components with states** replace one-off frames: `App/Button` (Primary/Secondary × Default/Pressed/Focus/Disabled), `App/Field` (Default/Focus/Filled/Error/Disabled), `App/Day cell` (Selected × Default/Focus), `App/Chip` (Default/Added/Focus).
2. **New colour roles:** `error` (Day #A3321E 5.5:1, Night #F0876A 5.9:1) and `focus` (Day #24586B 6.3:1, Night #E0B565 7.8:1). An error is border + icon + text, never colour alone; the typed value keeps full contrast. Focus = 2 px gap + 3 px ring.
3. **Today (first plan)** gets the full 0005 card: guidance line, "Full session", "✓ On your watch", a ⋯ menu that states each action's effect, underlined links with 44 px targets, plain-word meta ("Base · week 1 of 34", "236 days to MUT 60"), and a day-1 reason built from the starting point.
4. **Added states:** sign-in loading and failed, "Check connection" loading, "Build my plan" disabled with a reason, plan build failed, menu open.
5. **Season progress line:** the "ahead" part is raised to 54% so it meets 3:1 in both themes.
6. **Map labels on Sign in are decorative on purpose** (Arno): a small detail to discover, not information. They are `aria-hidden`, so the 4.5:1 text rule doesn't apply.
7. **Phone-only scope:** 390 px only. The brief defines an installable phone app, so 768/1440 are out of scope for round 1.
8. **Three type families** (Gluten, Carter One, Familjen Grotesk) is an accepted exception to the two-family guideline: each has one job (titles, numbers, reading).

## Evidence

WCAG 2.2 AA (1.4.3, 1.4.11, 1.4.1, 2.4.7, 2.5.8); the design review report; decision 0005; the brief (platform).

## Consequences

- Validate next: Daan tests the prototype (decision 0004). Sections are marked "Ready for dev" only after that.
- Figma API note: dev status and named versions can't be set via the connector; Arno sets them.

## Case-study note

The review said "not ready"; fixing it meant building real components with every state, not polishing screens.
