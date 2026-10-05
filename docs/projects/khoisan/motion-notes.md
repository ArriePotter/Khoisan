# Motion notes: Project Khoisān

Motion intent captured during Design, to be specified properly in the motion phase (`motion-design` skill). Each note says what moves, why, and the reduced-motion fallback.

| # | Element | Behaviour | Why | Reduced motion | Source |
|---|---|---|---|---|---|
| 1 | Season progress on Today (`App/Season progress`), on page open | In sequence: (1) the solid line draws from Start to today's position, slow at first and speeding up as it nears today's point; (2) today's checkpoint gives one outward glow pulse; (3) the checkpoint's name appears under the checkpoint, then slides left to its left-aligned resting place below the course. | Relentless: the season builds up to where you are today, then the screen settles into a calm, scannable state. | Show the final state straight away, with no draw, glow or slide. | Arno, 2026-10-05 |
| 2 | Loading screen | The ridgeline draws line by line, left to right. | Grounded + Relentless motif. | Static ridgeline. | Decision 0007 |

**To test in the motion phase:** accelerating *into* a stop can feel abrupt. If it does, add a short settle at the end (*judgement*).
