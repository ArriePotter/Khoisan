# Training research behind the plan

Research notes (October 2026) behind the numbers in `functions/src/engine/skeleton.ts`, the guardrails and the coach prompt.

## Race

MUT 60 by UTMB: 58 km, ~3,005 m+, Saturday 29 May 2027, start 06:30 at Witfontein, 15 h cutoff. Single track through the Outeniqua Mountains: Cradock Pass, Pass to Pass, Campherskloof, Tierkop, Tonnelbos, and Montagu Pass at halfway. 4 aid stations. The course sits above 800 m with changeable weather. Estimated finishing times are 6–15 h.
Sources: [UTMB](https://mut.utmb.world/races/mut60), [George Trails](https://georgetrails.org.za/mut-60-km/).

## Decisions

| Topic | Evidence | What the plan does |
|---|---|---|
| Weekly volume | Beginner/intermediate 50K plans peak around 56–72 km/week; experienced runners 80+ ([vert.run](https://vert.run/the-ultimate-50km-training-guide/), [Trail Runner](https://www.trailrunnermag.com/training/trail-tips-training/an-advanced-50k-training-plan-for-trail-runners/)). Weekly volume is the strongest training predictor of ultra performance ([Tanda & Knechtle 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4425319)). | Peaks at **~70 km/week**, the top of the first-timer/intermediate range, because the course is steeper than a flat 50K. |
| Long run | Aim for 4–5 h on feet for a 50K, rather than race distance; back-to-backs build fatigue resistance with less injury risk ([Marathon Handbook](https://marathonhandbook.com/ultramarathon-long-runs/)). Higdon's 26-week 50K plan peaks at a 5 h effort ([Hal Higdon](https://www.halhigdon.com/training-programs/more-training/ultramarathon-50k/)). | Athletes' rule: **no training run of 60 km or more**. Long run peaks at **~36 km with ~1,900 m** (6–7 h) 4 weeks out; **back-to-back weekends** in the peak phase. Long run ≤ 50–55% of the week, and the guardrails never allow more than 42 km. |
| Climbing | Build weekly vert to 50–75% of race gain; one uphill session per week; long runs at race-like m/km ([Trail Runner: Chasing Vert](https://www.trailrunnermag.com/training/trail-tips-training/chasing-vert-2/), [Ultra Training App](https://www.ultratrainingapp.com/ultra-running-blog/training-strategies-for-elevation-gain)). | Peaks at **~2,250 m/week** (≈ 75% of race). There's a weekly hill session, and the race simulation is climbing-heavy. |
| Progression | Novices increasing more than 30% over 2 weeks had more distance-related injuries ([Nielsen et al. 2014, JOSPT](https://www.jospt.org/doi/10.2519/jospt.2014.5164)). The strict 10% rule itself has weak evidence. | The plan grows **≤ 10%/week** (≈ 21% over 2 weeks), with a **cutback every 4th week**. The coach is also capped at 12% + 3 km above what you *actually* ran. |
| Intensity | Elite endurance athletes train ~80% easy ([Seiler / polarised training](https://www.trainingpeaks.com/blog/does-polarized-training-really-work/)). For amateurs, pyramidal is about as effective as polarised. | ~80% easy. **Max 2 quality sessions** (hills first, intervals/tempo in build/peak), never back to back. |
| Downhill / strength | Prior downhill running reduces later muscle damage (repeated-bout effect). Strength work, especially eccentric and long-length isometric, gives similar protection ([PMC12846201](https://pmc.ncbi.nlm.nih.gov/articles/PMC12846201), [Higher Running](https://higherrunning.com/the-repeated-bout-effect-eccentric-loading/)). | **2 short strength sessions/week** on rest/easy days, plus regular downhill practice in long runs and hill sessions. |
| Taper | About 2 weeks with volume cut 41–60% and intensity kept is optimal; worth roughly 2–3% ([TrainRight](https://trainright.com/tapering-ultrarunning-prevent-taper-tantrum), [ctyeh](https://ctyeh.com/articles/1604?lang=en)). | **Taper weeks at 60% then 40%** of peak volume, keeping short intensity; race week ~20%. |
| Daily readiness | HRV-guided training (hard sessions only when HRV is within the athlete's normal range) matched or beat fixed plans in runners ([Vesterinen et al.](https://jyx.jyu.fi/bitstream/handle/123456789/50625/vesterinenetalindividualendurancemsse.pdf?sequence=1), Kiviniemi 2007). | **05:00 check**: HRV, resting HR, sleep and form are compared with your own baseline. A bad morning softens hard days; it never adds load. |
| Starting point | Self-reported training is often optimistic. | No questions at setup: the plan starts from **synced data** (average km over the last 28 days, longest run in the last 6 weeks). |

## Example: starting from ~5 km/week (October 2026)

Weekly volume 10 → ~70 km, climbing 150 → ~2,250 m/week, long run 5 → 36 km (race simulation on 26 April 2027), taper from 10 May, race on 29 May.
