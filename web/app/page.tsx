"use client";

import { useMemo, useState } from "react";
import { SleepChart, TrendChart, VolumeChart } from "@/components/charts";
import { Button, Card, ReadinessBadge, SessionRow, StatTile } from "@/components/ui";
import { useRequireAthlete } from "@/lib/auth";
import { useActivities, useAllStats, useWeeks, useWellness } from "@/lib/data";
import { callReplanNow, callSyncNow } from "@/lib/firebase";
import { addDays, dayLabel, localToday, mondayOf, PHASE_LABEL, shortDate } from "@/lib/format";
import type { Activity, WeekPlan } from "@/lib/types";

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

function sumByDate(activities: Activity[]) {
  const map = new Map<string, { km: number; vertM: number }>();
  for (const a of activities) {
    if (!RUN_TYPES.has(a.type)) continue;
    const cur = map.get(a.date) ?? { km: 0, vertM: 0 };
    map.set(a.date, { km: cur.km + a.distanceKm, vertM: cur.vertM + a.elevGainM });
  }
  return map;
}

export default function TodayPage() {
  const { user, athlete, loading } = useRequireAthlete();
  const uid = athlete ? user?.uid : undefined;
  const today = localToday(athlete?.timezone);
  const thisWeek = mondayOf(today);

  const weeks = useWeeks(uid);
  const activities = useActivities(uid, addDays(thisWeek, -7 * 12));
  const wellness = useWellness(uid, addDays(today, -90));
  const sleepHistory = useWellness(uid, addDays(today, -365));
  const allStats = useAllStats();
  const stats = allStats?.find((s) => s.id === uid);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const byDate = useMemo(() => sumByDate(activities ?? []), [activities]);
  const week = weeks?.find((w) => w.weekStart === thisWeek);
  const totalWeeks = weeks?.length ?? 0;
  const todaySession = week?.sessions.find((s) => s.date === today);

  const volume = useMemo(() => {
    if (!weeks) return [];
    const done = new Map<string, { km: number; vertM: number }>();
    for (const [date, v] of byDate) {
      const ws = mondayOf(date);
      const cur = done.get(ws) ?? { km: 0, vertM: 0 };
      done.set(ws, { km: cur.km + v.km, vertM: cur.vertM + v.vertM });
    }
    return weeks
      .filter((w) => w.weekStart >= addDays(thisWeek, -7 * 11) && w.weekStart <= addDays(thisWeek, 7 * 4))
      .map((w) => ({
        weekStart: w.weekStart,
        km: { planned: w.source === "none" ? w.targetKm : w.plannedKm, done: Math.round((done.get(w.weekStart)?.km ?? 0) * 10) / 10 },
        vert: { planned: w.source === "none" ? w.targetVertM : w.plannedVertM, done: Math.round(done.get(w.weekStart)?.vertM ?? 0) },
      }));
  }, [weeks, byDate, thisWeek]);

  const descent = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const a of activities ?? []) {
      if (!RUN_TYPES.has(a.type)) continue;
      const w = mondayOf(a.date);
      byWeek.set(w, (byWeek.get(w) ?? 0) + (a.descentM ?? 0));
    }
    return Array.from({ length: 12 }, (_, i) => addDays(thisWeek, -7 * (11 - i))).map((w) => ({ weekStart: w, planned: null, done: Math.round(byWeek.get(w) ?? 0) }));
  }, [activities, thisWeek]);

  const hrv = (wellness ?? []).filter((w) => w.hrv).map((w) => ({ date: w.date, value: w.hrv as number }));
  const vo2 = (wellness ?? []).filter((w) => w.vo2max).map((w) => ({ date: w.date, value: w.vo2max as number }));
  const hrvBase = athlete?.readiness?.metrics.hrvBaseline;
  const sleepRows = (wellness ?? []).filter((w) => w.sleepH != null);
  // Garmin files sleep under the night's start date: last night is today's row or yesterday's.
  const lastNight = sleepRows.find((w) => w.date === today) ?? sleepRows.find((w) => w.date === addDays(today, -1)) ?? null;
  const lastSleep = lastNight ?? sleepRows.at(-1) ?? null;
  const sleepYear = (sleepHistory ?? []).map((w) => ({ date: w.date, hours: w.sleepH, score: w.sleepScore ?? null }));

  if (loading || !athlete) return null;


  async function run(label: string, fn: () => Promise<string>) {
    setBusy(label);
    setMessage(null);
    try {
      setMessage(await fn());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Hi {athlete.displayName}</h1>
          {week && (
            <p className="text-sm text-ink-2">
              {PHASE_LABEL[week.phase]} phase{week.isCutback ? " · cutback week" : ""} · week {week.index + 1} of {totalWeeks}
            </p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" disabled={!!busy} onClick={() => run("sync", async () => {
            const r = (await callSyncNow()).data;
            return `Synced ${r.activities} activities and ${r.wellness} wellness days.` + (r.stravaOnly ? ` ${r.stravaOnly} came only from Strava and were skipped; connect your watch to intervals.icu directly.` : "");
          })}>
            {busy === "sync" ? "Syncing…" : "Sync now"}
          </Button>
          <Button variant="ghost" disabled={!!busy} onClick={() => run("replan", async () => {
            await callReplanNow();
            return "This week has been re-planned and sent to your watch.";
          })}>
            {busy === "replan" ? "Planning…" : "Re-plan week"}
          </Button>
        </div>
      </div>
      {message && <p className="card px-4 py-3 text-sm text-ink-2">{message}</p>}
      {athlete.heartRate?.reliable === false && (
        <div className="card px-4 py-3 text-sm">
          <div className="font-medium">▲ Heart-rate data needs fixing</div>
          <p className="mt-1 text-ink-2">{athlete.heartRate.issue}</p>
          <p className="mt-1 text-xs text-muted">Until then, workouts use effort (easy / steady / hard) instead of heart-rate zones.</p>
        </div>
      )}
      {!!athlete.stravaOnlyActivities && (
        <p className="card px-4 py-3 text-sm text-ink-2">
          ▲ {athlete.stravaOnlyActivities} recent activities reached intervals.icu only via Strava, so the coach can&apos;t see them. Connect Garmin/COROS directly in intervals.icu.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Card title="Today" className="md:col-span-3">
          {todaySession ? (
            <SessionRow session={todaySession} done={byDate.get(today) ?? null} isToday isPast={false} />
          ) : (
            <p className="text-sm text-muted">No session planned for today.</p>
          )}
        </Card>
        <Card title="Recovery" className="md:col-span-2">
          <ReadinessBadge readiness={athlete.readiness} />
          <ul className="mt-2 space-y-1 text-xs text-ink-2">
            {(athlete.readiness?.reasons ?? ["Checked every morning at 05:00."]).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {lastSleep && !lastNight && (
            <p className="mt-2 text-xs text-muted">Last night&apos;s sleep hasn&apos;t come through from your watch yet.</p>
          )}
          {athlete.readiness && (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-muted">HRV</dt><dd className="font-medium tabular">{athlete.readiness.metrics.hrv?.toFixed(0) ?? "—"} ms</dd></div>
              <div><dt className="text-muted">Resting HR</dt><dd className="font-medium tabular">{athlete.readiness.metrics.restingHR ?? "—"} bpm</dd></div>
              <div>
                <dt className="text-muted">Sleep</dt>
                <dd className="font-medium tabular">
                  {lastSleep ? `${lastSleep.sleepH?.toFixed(1) ?? "—"} h${lastSleep.sleepScore != null ? ` · ${lastSleep.sleepScore.toFixed(0)}` : ""}` : "—"}
                </dd>
                {lastSleep && <dd className="text-muted">{lastNight ? "last night" : `night of ${shortDate(lastSleep.date)}`}</dd>}
              </div>
            </dl>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Last 7 days" value={`${stats?.last7Km?.toFixed(1) ?? "—"} km`} sub={`${stats?.last28Km?.toFixed(0) ?? "—"} km in 28 days`} />
          <StatTile label="VO2 max" value={stats?.vo2max ? String(stats.vo2max) : "—"} sub="from your watch" />
          <StatTile
            label="Easy running (28 days)"
            value={stats?.easySharePct28 != null ? `${stats.easySharePct28}%` : "—"}
            sub={athlete.heartRate?.reliable === false ? "needs reliable heart rate" : "target ~80%"}
          />
          <StatTile label="Descent (7 days)" value={`${stats?.weekly?.at(-1)?.descentM ?? 0} m`} sub="downhill training for MUT" />
      </div>

      {week && <UpcomingWeeks weeks={weeks ?? []} thisWeek={thisWeek} today={today} byDate={byDate} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Weekly distance (km)">
          <VolumeChart unit="km" data={volume.map((v) => ({ weekStart: v.weekStart, ...v.km }))} />
        </Card>
        <Card title="Weekly climbing (m)">
          <VolumeChart unit="m" data={volume.map((v) => ({ weekStart: v.weekStart, ...v.vert }))} />
        </Card>
        <Card title="Weekly descent (m)">
          <VolumeChart unit="m" showPlanned={false} data={descent} />
        </Card>
        <Card title="HRV (ms)">
          <TrendChart
            data={hrv}
            unit="HRV ms"
            band={hrvBase ? { low: hrvBase * 0.9, high: hrvBase * 1.1, label: "Your normal" } : undefined}
          />
        </Card>
        <Card title="Sleep">
          <SleepChart rows={sleepYear} lastNight={lastNight?.date ?? addDays(today, -1)} />
        </Card>
        <Card title="VO2 max">
          <TrendChart data={vo2} unit="VO2 max" digits={1} />
        </Card>
      </div>

    </div>
  );
}

const WEEK_TABS = ["This week", "Next week", "In 2 weeks", "In 3 weeks"];

function UpcomingWeeks({
  weeks,
  thisWeek,
  today,
  byDate,
}: {
  weeks: WeekPlan[];
  thisWeek: string;
  today: string;
  byDate: Map<string, { km: number; vertM: number }>;
}) {
  const [offset, setOffset] = useState(0);
  const week = weeks.find((w) => w.weekStart === addDays(thisWeek, 7 * offset));
  const planned = week ? week.sessions.filter((s) => s.type !== "race").reduce((a, s) => a + s.distanceKm, 0) : 0;
  const done = week ? week.sessions.reduce((a, s) => a + (byDate.get(s.date)?.km ?? 0), 0) : 0;
  const isDraft = offset >= 2;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap gap-1">
        {WEEK_TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setOffset(i)}
            className={`rounded-lg px-3 py-1.5 text-sm ${offset === i ? "bg-surface-2 font-medium" : "text-ink-2 hover:bg-surface-2"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!week || week.source === "none" ? (
        <p className="text-sm text-muted">Not planned yet.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-baseline gap-2 text-sm text-ink-2">
            <span>
              Week of {dayLabel(week.weekStart)} · {PHASE_LABEL[week.phase]}
              {week.isCutback ? " · cutback" : ""}
            </span>
            {isDraft && <span className="rounded bg-surface-2 px-1.5 py-0.5">Draft: updated each Sunday</span>}
            <span className="ml-auto tabular">
              {offset === 0 ? `${done.toFixed(1)} / ` : ""}
              {planned.toFixed(0)} km · {week.plannedVertM} m up
            </span>
          </div>
          {offset === 0 && (
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-series-1" style={{ width: `${Math.min(100, planned ? (done / planned) * 100 : 0)}%` }} />
            </div>
          )}
          <div className="space-y-3">
            {week.sessions.map((s) => (
              <SessionRow key={s.date} session={s} done={byDate.get(s.date) ?? null} isToday={s.date === today} isPast={s.date < today} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
