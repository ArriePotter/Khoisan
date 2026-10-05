# Handoff: onboarding + Today (first plan), v1

- **Status:** Package ready · **pending Validate** (Daan's prototype test, decision 0004)
- **Figma:** ✅ Ready for dev → "Onboarding + Today (first plan) · Day trail / Night trail · v1"; prototype on 🧪 Prototype (Flow 1 happy path, Flow 2 wrong ID)
- **Scope:** 390 px phone only (decision 0009); themes Day trail (Sandstone light) and Night trail (Basalt) via variable modes

## Checklist (figma-craft)

| Item | Status | Note |
|---|---|---|
| Frames named Breakpoint / Page / State | ✅ | |
| Breakpoints 390 / 768 / 1440 | ⚠️ Out of scope | Phone-only (0009) |
| Auto layout + resize test | ✅ | Background art (topo, texture) is absolute by design |
| No detached instances, no leftovers | ⚠️ | Hidden helper layers remain in early exploration pages, not in handoff frames |
| Values bound to variables | ✅ | Explore-v5 roles; some spacing still typed numbers (to tokenise in build) |
| Text styles | ✅ | |
| Code syntax on variables | ✅ | |
| Interactive states | ✅ | App/Button, App/Field, App/Day cell, App/Chip |
| Screen states | ✅ | Ideal, loading, error, disabled, failed, menu open |
| Copy reviewed (content-design) | ✅ | Curly quotes, "Tap Generate", plain meta |
| Alt text / decorative | ✅ | Topo map + labels `aria-hidden`; season progress role=img with label |
| Headings, landmarks, focus order | ✅ | Dev Mode annotations on every frame |
| Contrast both modes | ✅ | Text ≥ 4.5:1; UI and graphics ≥ 3:1 |
| Touch targets | ✅ | Buttons 52, fields 52, chips 44, day cells 44×48, links ≥ 44, menu 44 |
| Motion annotated with tokens | ✅ | `motion-notes.md` |
| Fonts licensed | ✅ | Gluten, Carter One, Familjen Grotesk: Google Fonts, OFL |
| Decision records | ✅ | 0005–0009 |

## Open before "Ready for dev"

1. Run Validate with Daan (both flows) and log findings.
2. Arno sets the sections to "Ready for dev" in Figma and saves the named version "Handoff: onboarding v1".
