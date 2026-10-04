"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { EFFORT_LABELS, type CompareStats, type Readiness, type RunHighlight, type Session } from "@/lib/types";
import { dayLabel, duration, fullDate } from "@/lib/format";
import { exerciseList, stepList } from "@/lib/workout";
import { dose, exerciseImageUrl, parseExerciseLine } from "@/lib/exercises";
import { BarbellIcon, PersonSimpleTaiChiIcon } from "@phosphor-icons/react";
import { ActivityIcon } from "./ActivityIcon";

export function Card({ title, action, children, className = "" }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center gap-2">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          <div className="ml-auto">{action}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

const READINESS = {
  green: { color: "var(--good)", icon: "●", label: "Ready to train" },
  amber: { color: "var(--warning)", icon: "▲", label: "Take it a bit easier" },
  red: { color: "var(--critical)", icon: "■", label: "Recovery needed" },
  unknown: { color: "var(--muted)", icon: "○", label: "Building your baseline" },
} as const;

export function ReadinessBadge({ readiness }: { readiness?: Readiness }) {
  const r = READINESS[readiness?.level ?? "unknown"];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span style={{ color: r.color }} aria-hidden>
        {r.icon}
      </span>
      {r.label}
    </span>
  );
}

const INTENSITY_STYLE: Record<string, string> = {
  rest: "text-muted",
  easy: "text-ink-2",
  moderate: "text-ink",
  hard: "text-ink font-semibold",
};

export function SessionRow({
  session,
  done,
  isToday,
  isPast,
}: {
  session: Session;
  done: { km: number; vertM: number } | null;
  isToday: boolean;
  isPast: boolean;
}) {
  const [open, setOpen] = useState(isToday);
  const isRest = session.type === "rest";
  const isGym = session.type === "strength" || session.type === "mobility";
  const status = isRest || isGym ? null : done && done.km >= session.distanceKm * 0.8 ? "done" : done ? "partial" : isPast ? "missed" : null;
  const lines = isGym ? exerciseList(session.description) : stepList(session.description);
  const note = session.note ?? "";
  const facts = [
    session.distanceKm > 0 ? `${session.distanceKm} km` : "",
    session.vertM > 0 ? `${session.vertM} m climbing` : "",
    session.durationMin > 0 ? `~${session.durationMin} min` : "",
  ].filter(Boolean);
  const headline = session.distanceKm > 0 ? `${session.distanceKm} km` : session.durationMin > 0 ? `${session.durationMin} min` : "";
  const hasDetail = facts.length > 0 || lines.length > 0 || note;

  return (
    <div className={`rounded-xl border ${isToday ? "border-ink/40 bg-surface-2" : "border-line"} ${isRest ? "opacity-70" : ""}`}>
      <button
        type="button"
        onClick={() => hasDetail && setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className={isRest ? "text-muted" : "text-ink"}>
          <ActivityIcon session={session} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-ink-2">
            {dayLabel(session.date)}
            {isToday && <span className="ml-2 font-semibold text-ink">Today</span>}
          </span>
          <span className={`block truncate text-[15px] ${INTENSITY_STYLE[session.intensity] ?? ""}`}>{session.title}</span>
        </span>
        <span className="shrink-0 text-right text-sm tabular">
          {status === "done" ? (
            <span className="text-good-text">✓ {done!.km.toFixed(1)} km</span>
          ) : status === "partial" ? (
            <span className="text-ink-2">◐ {done!.km.toFixed(1)} / {headline}</span>
          ) : status === "missed" ? (
            <span className="text-muted">missed</span>
          ) : (
            <span className="text-ink-2">{headline}</span>
          )}
        </span>
        {hasDetail && <span className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>›</span>}
      </button>
      {open && hasDetail && (
        <div className="space-y-3 border-t border-line px-4 pb-4 pt-3 pl-[52px]">
          {facts.length > 0 && <p className="text-sm text-ink-2 tabular">{facts.join("  ·  ")}</p>}
          {isGym && lines.length > 0 && (
            <ul className="space-y-2">
              {lines.map((l, i) => (
                <ExerciseItem key={i} line={l} />
              ))}
            </ul>
          )}
          {!isGym && lines.length > 0 && (
            <ul className="space-y-1.5 text-[15px]">
              {lines.map((l, i) => (
                <li key={i} className="flex items-baseline gap-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 -translate-y-0.5 rounded-full bg-ink-2" aria-hidden />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          )}
          {note && <p className="text-sm text-ink-2">{note}</p>}
        </div>
      )}
    </div>
  );
}

function ExerciseItem({ line }: { line: string }) {
  const p = parseExerciseLine(line);
  if (!p) return <li className="text-sm text-ink-2">{line}</li>; // older free-text plans
  const Fallback = p.exercise.kind === "mobility" ? PersonSimpleTaiChiIcon : BarbellIcon;
  return (
    <li className="flex items-center gap-3">
      {p.exercise.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exerciseImageUrl(p.exercise.image)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-white object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-2">
          <Fallback size={26} weight="duotone" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[15px]">{p.exercise.name}</span>
        <span className="block text-sm text-ink-2 tabular">{dose(p)}</span>
      </span>
    </li>
  );
}

export function Button({ children, onClick, disabled, variant = "primary", type = "button", form }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "ghost"; type?: "button" | "submit"; form?: string }) {
  const base = "rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50";
  const style = variant === "primary" ? "bg-accent text-accent-ink" : "border border-line hover:bg-surface-2";
  return (
    <button type={type} form={form} onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

export function PersonalBests({ stats }: { stats?: CompareStats }) {
  const FEEL = ["strong", "good", "normal", "poor", "weak"];
  const highlight = (h: RunHighlight | null | undefined) =>
    h
      ? [
          fullDate(h.date),
          `${h.distanceKm.toFixed(1)} km`,
          `${h.vsTypicalPct > 0 ? "+" : ""}${h.vsTypicalPct}% vs typical`,
          h.feel ? `felt ${FEEL[h.feel - 1]}` : "",
          h.avgTempC != null ? `${Math.round(h.avgTempC)} °C` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "—";
  const rows: [string, string, string][] = [
    ...EFFORT_LABELS.map(({ key, label }): [string, string, string] => {
      const b = stats?.bests?.[key];
      return [`Fastest ${label}`, duration(b?.timeS), b ? fullDate(b.date) : ""];
    }),
    ["Longest run", stats?.longestRun ? `${stats.longestRun.distanceKm.toFixed(1)} km` : "—", stats?.longestRun ? fullDate(stats.longestRun.date) : ""],
    ["Strongest run", highlight(stats?.strongestRun), ""],
    ["Weakest run", highlight(stats?.weakestRun), ""],
  ];
  return (
    <div>
      <dl className="divide-y divide-line text-sm">
        {rows.map(([label, value, date]) => (
          <div key={label} className="flex items-baseline gap-3 py-1.5">
            <dt className="w-32 shrink-0 text-ink-2">{label}</dt>
            <dd className="font-medium tabular">{value}</dd>
            {date && <dd className="ml-auto text-xs text-muted">{date}</dd>}
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">
        Fastest times can come from inside a longer run. Strongest and weakest are from the last 90 days, scored on hill-adjusted pace per heartbeat
        {stats?.heartRate?.reliable === false ? " (hidden until your heart-rate data is fixed)." : "."}
      </p>
    </div>
  );
}
