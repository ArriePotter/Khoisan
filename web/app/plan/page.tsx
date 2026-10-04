"use client";

import { useMemo, useState } from "react";
import { Button, Card, SessionRow } from "@/components/ui";
import { callRebuildPlan } from "@/lib/firebase";
import { useRequireAthlete } from "@/lib/auth";
import { useActivities, useWeeks } from "@/lib/data";
import { addDays, dayLabel, localToday, mondayOf, PHASE_LABEL, RACE } from "@/lib/format";
import type { WeekPlan } from "@/lib/types";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export default function PlanPage() {
  const { user, athlete, loading } = useRequireAthlete();
  const uid = athlete ? user?.uid : undefined;
  const today = localToday(athlete?.timezone);
  const weeks = useWeeks(uid);
  const activities = useActivities(uid, athlete?.planStart ? mondayOf(athlete.planStart) : today);
  const [open, setOpen] = useState<string | null>(mondayOf(today));
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  async function rebuild() {
    if (!confirm("Rebuild the season from your latest synced data? Upcoming workouts on your watch will be replaced.")) return;
    setRebuilding(true);
    setRebuildMsg(null);
    try {
      const { baseline } = (await callRebuildPlan()).data;
      setRebuildMsg(`Plan rebuilt from your synced data (${baseline.weeklyKm} km/week, longest recent run ${baseline.longestRunKm} km).`);
    } catch (e) {
      setRebuildMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRebuilding(false);
    }
  }

  const doneByWeek = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities ?? []) {
      if (!RUN_TYPES.has(a.type)) continue;
      const w = mondayOf(a.date);
      m.set(w, (m.get(w) ?? 0) + a.distanceKm);
    }
    return m;
  }, [activities]);

  const byDate = useMemo(() => {
    const m = new Map<string, { km: number; vertM: number }>();
    for (const a of activities ?? []) {
      if (!RUN_TYPES.has(a.type)) continue;
      const cur = m.get(a.date) ?? { km: 0, vertM: 0 };
      m.set(a.date, { km: cur.km + a.distanceKm, vertM: cur.vertM + a.elevGainM });
    }
    return m;
  }, [activities]);

  if (loading || !athlete || !weeks) return null;
  const maxKm = Math.max(...weeks.map((w) => Math.max(w.targetKm, w.plannedKm ?? 0)), 1);
  const phases = groupPhases(weeks);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Season plan</h1>
          <p className="text-sm text-ink-2">
            {weeks.length} weeks to {RACE.name}. Tap a week to see its sessions.
          </p>
        </div>
        <Button variant="ghost" onClick={rebuild} disabled={rebuilding}>
          {rebuilding ? "Rebuilding…" : "Rebuild plan"}
        </Button>
      </div>
      {rebuildMsg && <p className="card px-4 py-3 text-sm text-ink-2">{rebuildMsg}</p>}

      <div className="flex overflow-hidden rounded-lg border border-line text-[11px]">
        {phases.map((p) => (
          <div key={p.phase} className="border-r border-line bg-surface px-2 py-1.5 last:border-r-0" style={{ flex: p.count }}>
            <div className="font-medium">{PHASE_LABEL[p.phase]}</div>
            <div className="text-muted">{p.count} wk</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="space-y-1">
          {weeks.map((w) => {
            const isCurrent = w.weekStart === mondayOf(today);
            const isPast = addDays(w.weekStart, 6) < today;
            const planned = w.source === "none" ? w.targetKm : w.plannedKm;
            const done = doneByWeek.get(w.weekStart) ?? 0;
            return (
              <div key={w.weekStart}>
                <button
                  onClick={() => setOpen(open === w.weekStart ? null : w.weekStart)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-surface-2 ${isCurrent ? "bg-surface-2" : ""}`}
                >
                  <span className="w-32 shrink-0 text-sm tabular">{dayLabel(w.weekStart)}</span>
                  <span className="w-20 shrink-0 text-xs">
                    {PHASE_LABEL[w.phase]}
                    {w.isCutback && <span className="text-muted"> · cut</span>}
                  </span>
                  <span className="relative h-3 flex-1 rounded-sm bg-surface-2" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(planned / maxKm) * 100}%`, background: "var(--planned)" }} />
                    {(isPast || isCurrent) && (
                      <span className="absolute inset-y-0.5 left-0 rounded-sm bg-series-1" style={{ width: `${(Math.min(done, maxKm) / maxKm) * 100}%` }} />
                    )}
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs text-ink-2 tabular">
                    {isPast || isCurrent ? `${done.toFixed(0)} / ` : ""}
                    {planned.toFixed(0)} km · {(w.source === "none" ? w.targetVertM : w.plannedVertM).toLocaleString()} m
                  </span>
                </button>
                {open === w.weekStart && <WeekDetail week={w} byDate={byDate} today={today} />}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-series-1" />Completed</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--planned)" }} />Planned</span>
        </div>
      </Card>
    </div>
  );
}

function WeekDetail({ week, byDate, today }: { week: WeekPlan; byDate: Map<string, { km: number; vertM: number }>; today: string }) {
  if (week.source === "none") {
    return (
      <p className="mx-2 mb-3 mt-1 text-xs text-muted">
        Sessions are planned the Sunday before, from your latest data. Target: {week.targetKm} km, {week.targetVertM} m climbing, long run {week.longRunKm} km.
      </p>
    );
  }
  return (
    <div className="mx-1 mb-4 mt-2 space-y-3">
      {week.sessions.map((s) => (
        <SessionRow key={s.date} session={s} done={byDate.get(s.date) ?? null} isToday={s.date === today} isPast={s.date < today} />
      ))}
    </div>
  );
}

function groupPhases(weeks: WeekPlan[]) {
  const out: { phase: string; count: number }[] = [];
  for (const w of weeks) {
    const last = out[out.length - 1];
    if (last?.phase === w.phase) last.count++;
    else out.push({ phase: w.phase, count: 1 });
  }
  return out;
}
