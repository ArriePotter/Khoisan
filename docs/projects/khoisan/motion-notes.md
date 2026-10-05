# Motion notes: Project Khoisān

Motion intent captured during Design, to be specified properly in the motion phase (`motion-design` skill). Each note says what moves, why, and the reduced-motion fallback.

| # | Element | Behaviour | Why | Reduced motion | Source |
|---|---|---|---|---|---|
| 1 | Season progress on Today (`App/Season progress`), on page open | In sequence: (1) the solid line draws from Start to today's position, slow at first and speeding up as it nears today's point; (2) today's checkpoint gives one outward glow pulse; (3) the checkpoint's name appears under the checkpoint, then slides left to its left-aligned resting place below the course. | Relentless: the season builds up to where you are today, then the screen settles into a calm, scannable state. | Show the final state straight away, with no draw, glow or slide. | Arno, 2026-10-05 |
| 2 | Loading screen | The ridgeline draws line by line, left to right. | Grounded + Relentless motif. | Static ridgeline. | Decision 0007 |
| 3 | Check beacon on the course profile (Sign in, Not invited) | The halo behind the ✓ pulses slowly, like a beacon: it scales out and fades, then repeats (about 2–3 s per cycle, gentle). Illustrative of reaching a checkpoint. | Relentless: a living point on the course, quietly drawing the eye to the race. | No pulse: show the dot and a static halo. | Arno, 2026-10-05 |

**To test in the motion phase:** accelerating *into* a stop can feel abrupt. If it does, add a short settle at the end (*judgement*).

## Tokens for build

| Token | Value | Used by |
|---|---|---|
| `--motion-duration-short` | 150 ms | Button press, focus ring |
| `--motion-duration-medium` | 300 ms | Screen transitions, menu sheet |
| `--motion-duration-draw` | 1200 ms | Season line draw (#1), ridgeline draw (#2) |
| `--motion-duration-pulse` | 2400 ms, infinite | Checkpoint beacon (#3) |
| `--motion-ease-out` | cubic-bezier(0.2, 0, 0, 1) | Entrances, sheet, label slide |
| `--motion-ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Beacon pulse |
| `--motion-ease-accelerate` | cubic-bezier(0.5, 0, 0.9, 0.6) | Season line draw (slow → fast), then a 120 ms settle |

All motion is wrapped in `@media (prefers-reduced-motion: no-preference)`; the reduced state is the final frame.
