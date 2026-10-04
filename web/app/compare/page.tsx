"use client";

import { CompareChart } from "@/components/charts";
import { Card } from "@/components/ui";
import { useRequireAthlete } from "@/lib/auth";
import { useAllStats } from "@/lib/data";
import { duration, shortDate } from "@/lib/format";
import { EFFORT_LABELS, type CompareStats } from "@/lib/types";

// Colour follows the athlete, never their rank: slots are assigned by sorted uid.
const SLOTS = ["var(--series-1)", "var(--series-2)"];

type Row = { label: string; get: (s: CompareStats) => number | null; fmt: (v: number) => string; lowerIsBetter?: boolean };

const ROWS: Row[] = [
  { label: "Distance since plan start", get: (s) => s.totalKm, fmt: (v) => `${v.toFixed(0)} km` },
  { label: "Climbing since plan start", get: (s) => s.totalVertM, fmt: (v) => `${v.toLocaleString()} m` },
  { label: "Time on feet", get: (s) => s.totalHours, fmt: (v) => `${v.toFixed(0)} h` },
  { label: "Last 7 days", get: (s) => s.last7Km, fmt: (v) => `${v.toFixed(1)} km` },
  { label: "Last 28 days", get: (s) => s.last28Km, fmt: (v) => `${v.toFixed(0)} km` },
  { label: "Longest run", get: (s) => s.longestRun?.distanceKm ?? null, fmt: (v) => `${v.toFixed(1)} km` },
  ...EFFORT_LABELS.map(({ key, label }): Row => ({ label: `Fastest ${label}`, get: (s) => s.bests?.[key]?.timeS ?? null, fmt: duration, lowerIsBetter: true })),
  { label: "VO2 max", get: (s) => s.vo2max, fmt: (v) => v.toFixed(0) },
  { label: "Fitness (CTL)", get: (s) => s.fitness, fmt: (v) => v.toFixed(0) },
  { label: "Plan completed", get: (s) => s.compliancePct, fmt: (v) => `${v}%` },
];

export default function ComparePage() {
  const { athlete, loading } = useRequireAthlete();
  const stats = useAllStats();
  if (loading || !athlete || !stats) return null;

  const athletes = [...stats].sort((a, b) => a.id.localeCompare(b.id)).map((s, i) => ({ ...s, color: SLOTS[i % SLOTS.length], key: `a${i}` }));
  if (athletes.length === 0) return <p className="text-sm text-muted">No stats yet. They appear after the first sync.</p>;

  const weeks = [...new Set(athletes.flatMap((a) => a.weekly.map((w) => w.weekStart)))].sort();
  const weeklyKm = weeks.map((w) => ({
    weekStart: w,
    ...Object.fromEntries(athletes.map((a) => [a.key, a.weekly.find((x) => x.weekStart === w)?.km ?? null])),
  }));
  const vo2Dates = [...new Set(athletes.flatMap((a) => a.vo2maxSeries.map((p) => p.date)))].sort();
  const vo2 = vo2Dates.map((d) => ({
    date: d,
    ...Object.fromEntries(athletes.map((a) => [a.key, a.vo2maxSeries.find((p) => p.date === d)?.value ?? null])),
  }));
  const series = athletes.map((a) => ({ key: a.key, label: a.displayName, color: a.color }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Compare</h1>
        <p className="text-sm text-ink-2">Headline numbers only. Each of you keeps your own plan and daily data private.</p>
      </div>

      <Card>
        <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-2">
              <th className="pb-2 font-normal" />
              {athletes.map((a) => (
                <th key={a.id} className="pb-2 text-right font-medium text-ink">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: a.color }} />
                  {a.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const vals = athletes.map((a) => row.get(a));
              const present = vals.filter((v): v is number => v != null);
              const best = present.length > 1 ? (row.lowerIsBetter ? Math.min(...present) : Math.max(...present)) : null;
              return (
                <tr key={row.label} className="border-t border-line">
                  <td className="py-2 text-ink-2">{row.label}</td>
                  {vals.map((v, i) => (
                    <td key={athletes[i].id} className={`py-2 text-right tabular ${v != null && v === best ? "font-semibold" : ""}`}>
                      {v != null ? row.fmt(v) : "—"}
                      {v != null && v === best && <span className="ml-1 text-xs text-muted" aria-label="leading">▲</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          ▲ marks the leader. Updated {athletes.map((a) => `${a.displayName} ${a.updatedAt ? shortDate(a.updatedAt.slice(0, 10)) : "—"}`).join(", ")}.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Weekly distance (km)">
          <CompareChart data={weeklyKm} series={series} unit="km" xKey="weekStart" digits={1} />
        </Card>
        <Card title="VO2 max">
          {vo2.length > 1 ? <CompareChart data={vo2} series={series} unit="" xKey="date" digits={1} /> : <p className="py-8 text-center text-sm text-muted">No VO2 max data yet.</p>}
        </Card>
      </div>
    </div>
  );
}
