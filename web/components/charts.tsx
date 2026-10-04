"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  LabelList,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { addDays, shortDate } from "@/lib/format";

const AXIS = { stroke: "var(--axis)", tick: { fill: "var(--muted)", fontSize: 11 }, tickLine: false } as const;
const GRID = <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />;

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="card px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-ink-2">
          {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-medium text-ink tabular">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; hollow?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={i.hollow ? { border: `1.5px solid ${i.color}` } : { background: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Weekly planned vs. completed (km or climbing). Planned is a neutral ghost bar. */
export function VolumeChart({
  data,
  unit,
  height = 220,
  showPlanned = true,
}: {
  data: { weekStart: string; planned: number | null; done: number }[];
  unit: string;
  height?: number;
  showPlanned?: boolean;
}) {
  return (
    <div>
      {showPlanned && <Legend items={[{ label: "Completed", color: "var(--series-1)" }, { label: "Planned", color: "var(--planned)" }]} />}
      <div style={{ height }} className="mt-2">
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            {GRID}
            <XAxis dataKey="weekStart" tickFormatter={shortDate} {...AXIS} minTickGap={16} />
            <YAxis {...AXIS} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={(p: TooltipContentProps<ValueType, NameType>) =>
                p.active && p.payload?.length ? (
                  <TooltipBox
                    title={`Week of ${shortDate(String(p.label))}`}
                    rows={[
                      { label: "Completed", value: `${p.payload.find((x) => x.dataKey === "done")?.value ?? 0} ${unit}`, color: "var(--series-1)" },
                      { label: "Planned", value: p.payload.find((x) => x.dataKey === "planned")?.value != null ? `${p.payload.find((x) => x.dataKey === "planned")?.value} ${unit}` : "—", color: "var(--planned)" },
                    ]}
                  />
                ) : null
              }
            />
            {showPlanned && <Bar isAnimationActive={false} dataKey="planned" fill="var(--planned)" radius={[4, 4, 0, 0]} maxBarSize={18} />}
            <Bar isAnimationActive={false} dataKey="done" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Single-series trend (VO2 max, HRV) with an optional shaded normal range. */
export function TrendChart({
  data,
  unit,
  band,
  height = 180,
  digits = 0,
}: {
  data: { date: string; value: number }[];
  unit: string;
  band?: { low: number; high: number; label: string };
  height?: number;
  digits?: number;
}) {
  if (data.length < 2) return <p className="py-8 text-center text-sm text-muted">Not enough data yet.</p>;
  const values = data.map((d) => d.value).concat(band ? [band.low, band.high] : []);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.15 || 1;
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          {GRID}
          {band && <ReferenceArea y1={band.low} y2={band.high} fill="var(--series-1)" fillOpacity={0.08} stroke="none" />}
          <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={24} />
          <YAxis {...AXIS} axisLine={false} width={44} domain={[Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)]} />
          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={(p: TooltipContentProps<ValueType, NameType>) =>
              p.active && p.payload?.length ? (
                <TooltipBox
                  title={shortDate(String(p.label))}
                  rows={[
                    { label: unit, value: Number(p.payload[0].value).toFixed(digits), color: "var(--series-1)" },
                    ...(band ? [{ label: band.label, value: `${band.low.toFixed(0)}–${band.high.toFixed(0)}` }] : []),
                  ]}
                />
              ) : null
            }
          />
          <Line isAnimationActive={false} type="monotone" dataKey="value" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two athletes on one scale. Colour follows the athlete (slot order is fixed by uid sort). */
export function CompareChart({
  data,
  series,
  unit,
  xKey,
  height = 240,
  digits = 0,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; label: string; color: string }[];
  unit: string;
  xKey: string;
  height?: number;
  digits?: number;
}) {
  return (
    <div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <div style={{ height }} className="mt-2">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            {GRID}
            <XAxis dataKey={xKey} tickFormatter={shortDate} {...AXIS} minTickGap={24} />
            <YAxis {...AXIS} axisLine={false} width={44} domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
              content={(p: TooltipContentProps<ValueType, NameType>) =>
                p.active && p.payload?.length ? (
                  <TooltipBox
                    title={shortDate(String(p.label))}
                    rows={series.map((s) => {
                      const v = p.payload.find((x) => x.dataKey === s.key)?.value;
                      return { label: s.label, value: v != null ? `${Number(v).toFixed(digits)} ${unit}` : "—", color: s.color };
                    })}
                  />
                ) : null
              }
            />
            {series.map((s) => (
              <Line isAnimationActive={false}
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                connectNulls
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const nightLabel = (d: string) => {
  const date = new Date(`${d}T00:00:00Z`);
  return `${date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} ${date.getUTCDate()}`;
};

/**
 * Sleep per night, 7 nights at a time, pannable backwards. Bars are hours; the
 * sleep score is a direct label above each bar (no second axis). Rows are dated
 * by the night's start, as Garmin/intervals.icu file them.
 */
export function SleepChart({ rows, lastNight }: { rows: { date: string; hours: number | null; score: number | null }[]; lastNight: string }) {
  const [page, setPage] = useState(0);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const end = addDays(lastNight, -7 * page);
  const nights = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6));
  const data = nights.map((d) => ({ date: d, hours: byDate.get(d)?.hours ?? null, score: byDate.get(d)?.score ?? null }));
  const earliest = rows.reduce((m, r) => (r.date < m ? r.date : m), lastNight);
  const canGoBack = nights[0] > earliest;
  const yMax = Math.max(12, Math.ceil(Math.max(...data.map((d) => d.hours ?? 0)) / 4) * 4);
  const nav = "rounded-lg border border-line px-2.5 py-1 text-xs disabled:opacity-30 hover:bg-surface-2";

  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-ink-2">
        <span className="tabular">
          {shortDate(nights[0])} – {shortDate(nights[6])}
        </span>
        <span className="text-muted">· bars: hours · number: sleep score</span>
        <span className="ml-auto flex gap-1.5">
          <button type="button" className={nav} disabled={!canGoBack} onClick={() => setPage(page + 1)} aria-label="Earlier week">
            ‹ Earlier
          </button>
          <button type="button" className={nav} disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Later week">
            Later ›
          </button>
        </span>
      </div>
      <div style={{ height: 200 }} className="mt-2">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
            {GRID}
            <XAxis dataKey="date" tickFormatter={nightLabel} {...AXIS} interval={0} />
            <YAxis
              {...AXIS}
              axisLine={false}
              width={44}
              domain={[0, yMax]}
              ticks={Array.from({ length: yMax / 4 + 1 }, (_, i) => i * 4)}
              interval={0}
              tickFormatter={(v) => `${v} h`}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)" }}
              content={(p: TooltipContentProps<ValueType, NameType>) => {
                if (!p.active || !p.payload?.length) return null;
                const row = p.payload[0].payload as { date: string; hours: number | null; score: number | null };
                return (
                  <TooltipBox
                    title={`Night of ${nightLabel(row.date)} ${shortDate(row.date).split(" ")[1] ?? ""}`}
                    rows={[
                      { label: "Sleep", value: row.hours != null ? `${row.hours.toFixed(1)} h` : "not synced", color: "var(--series-1)" },
                      { label: "Score", value: row.score != null ? String(Math.round(row.score)) : "—" },
                    ]}
                  />
                );
              }}
            />
            <Bar isAnimationActive={false} dataKey="hours" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={34}>
              <LabelList
                dataKey="score"
                position="top"
                formatter={(v: unknown) => (v == null ? "" : String(Math.round(Number(v))))}
                style={{ fill: "var(--ink-2)", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
