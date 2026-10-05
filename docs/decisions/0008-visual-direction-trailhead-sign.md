# 0008: Visual direction "Trailhead sign" (A1) and its refinements

- **Date:** 2026-10-05
- **Status:** Accepted
- **Department:** Visual design (+ interaction, motion intent)
- **Phase:** Design
- **Decided by:** Arno
- **Figma:** [💡 Explorations → Visual v5](https://www.figma.com/design/plcCxrmXnhvGsqFi5dH1bD), frame "v5 A1 Trailhead sign"; component `App/Season progress`

## Context

The Today structure was fixed in Explore (decision 0005); the brand attributes are Rugged, Grounded, Relentless (0007). The visual layer took six rounds:

| Round | What it was | Why it was rejected |
|---|---|---|
| v0 | Rounded cards on beige, faint topo | "Generic AI slop": template layout, timid palette, moodboard unused |
| V1 / V2 | Trail-blaze signage; field-map poster | Built before Arno's moodboard was annotated; "step back" |
| v3 | Soft serif + pastel nature palette | Labels too "code", tone too delicate |
| v4 A–C | Same layout, earthier palette, three slab/retro faces | Still a font swap on the same layout |
| v5 B / C | Map print; volcanic moss | Not chosen; A captured the corten-sign reference best |

## Decision

**Direction:** v5 A, "Trailhead sign". The whole screen is weathered corten steel with an engraved topo map, taken from Arno's corten-sign reference.

**Refinements to A1, each with its reason (Arno's, recorded 5 Oct):**

| Refinement | Why |
|---|---|
| Title in **Gluten Light**, hero numbers in **Carter One** | Hand-made, organic letterforms that match the brand. Arno chose them for the quality he takes from the rock-art inspiration: drawn by hand, not engineered. A *quality*, not a copied motif (0007). Both are free Google Fonts (OFL). |
| **Course profile at the bottom** of the screen | The race becomes the horizon the session sits above. Today's information stays in the reading zone. |
| **Season progress on the real course** (GPX), checkpoints at the engine's true phase points: Start, Base, Build, Peak, Taper, Race day | Relentless: you see how much base is ahead. Positions follow `phaseFor` in `skeleton.ts`, not even spacing. |
| **Only the current checkpoint's name shows**, left-aligned below the course | One label at a time stays calm and readable; six labels crowded the line. |
| **Dots, not flags,** at Start and Race day | Flags were tried and added noise; dots keep the line clean. |
| **Background blur behind the "Easy today" plate** and a **progressive blur** fading up behind the week strip | Readability: the topo lines run behind small text and make it harder to read. Blurring the texture there keeps the steel feel while the text stays clear. The progressive blur has no hard edge, so it doesn't look like a card. |
| **Rounded top corners on the tab bar** | Echoes the course shape: the start and the finish of the mountain both sit at low elevation, rounding up at the ends. |
| **Ochre ring on Today** in the week | Makes today findable at a glance; the one warm accent on the steel. |

## Evidence

- Arno's annotated moodboard (Figma 🔬 Research, 03b and the annotated references), which set the threads: handmade, nature palette, big calm blocks, topo linework, real texture.
- Contrast (WCAG 2.2): cream on corten ~7.1:1; ochre ring on corten 4.47:1 (≥ 3:1 for indicators, 1.4.11); today is also marked by size, not colour alone (1.4.1).
- Course data: MUT 60 2026 GPX (57.4 km, 222–986 m), downsampled; labelled "2026 course" until the 2027 route is published.
- The readability rationale for the blurs is *judgement*: WCAG measures colour contrast, not busy backgrounds, so we decided this by eye and confirm it in Validate.

## Consequences

- Corten is the brand surface. Night trail needs its own treatment (a darker, oiled steel), still to design.
- Blurs in code: `backdrop-filter` (plus `mask-image` for the progressive fade), with a sharp/solid fallback.
- Motion intent is in `docs/projects/khoisan/motion-notes.md`.
- Next: apply A1 to the other Today states and to onboarding, design Night trail, then the `design-critic` design review.

## Case-study note

It took six rounds to find the look; the one that stuck came from my own references, and every refinement after it has a reason I can state.

## Update (5 Oct, later)

- **Palettes:** Day trail = Sandstone light (all ink, accent Deep ocean #24586B, which replaced corten after Arno found it clashed); Night trail = Basalt (off-white text #F2EFE8, ochre accent). Corten became an exploration only.
- **Card treatment:** lines are faded inside every card, field and secondary button (card-shaped backdrop at 35% of line strength by day, 15% by night), replacing the blurs; blur thickened lines.
- **Sign in:** map-style contours (index + stippled lines) with decorative labels set into the lines, race coordinates, a checkpoint beacon on the course; lines faded behind the title.
- Review fixes are recorded in 0009.
