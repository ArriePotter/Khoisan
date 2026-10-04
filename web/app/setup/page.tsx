"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { callConnect } from "@/lib/firebase";

const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SetupPage() {
  const { user, athlete, loading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trainingDays, setTrainingDays] = useState<number[]>([]);
  const [longRunDay, setLongRunDay] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login/");
    else if (athlete) router.replace("/");
  }, [loading, user, athlete, router]);

  function toggleDay(d: number) {
    const next = trainingDays.includes(d) ? trainingDays.filter((x) => x !== d) : [...trainingDays, d].sort();
    setTrainingDays(next);
    if (longRunDay !== null && !next.includes(longRunDay)) setLongRunDay(null);
  }

  const scheduleError =
    trainingDays.length < 3
      ? "Pick at least 3 training days."
      : trainingDays.length > 6
        ? "Keep at least one rest day."
        : longRunDay === null
          ? "Pick your long-run day."
          : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (scheduleError || longRunDay === null) return setError(scheduleError);
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await callConnect({
        displayName: String(f.get("displayName")),
        intervalsAthleteId: String(f.get("athleteId")),
        intervalsApiKey: String(f.get("apiKey")),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: String(f.get("notes") || ""),
        availability: { trainingDays, longRunDay },
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const dayButton = (selected: boolean) =>
    `rounded-lg border px-0 py-2 text-sm ${selected ? "border-accent bg-accent text-accent-ink" : "border-line hover:bg-surface-2"}`;

  return (
    <form id="setup" onSubmit={submit} className="mx-auto max-w-lg space-y-4 pt-4">
      <div>
        <h1 className="text-xl font-semibold">Set up your plan</h1>
        <p className="mt-1 text-sm text-ink-2">
          Goal: MUT 60 on 29 May 2027. Your current fitness is read from your intervals.icu history, and your workouts are sent back to your watch.
        </p>
      </div>

      <Card title="1. Connect intervals.icu">
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs text-ink-2">
          <li>Create a free account at intervals.icu.</li>
          <li>Settings → Connections: connect <b>Garmin</b> or <b>COROS</b> directly (not Strava). Allow uploading planned workouts.</li>
          <li>Settings → Developer Settings: copy your <b>Athlete ID</b> and generate an <b>API key</b>.</li>
        </ol>
        <div className="space-y-3">
          <label className="block text-sm">
            Your name
            <input name="displayName" required defaultValue={user?.displayName?.split(" ")[0] ?? ""} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Athlete ID
              <input name="athleteId" required placeholder="i123456" className={field} />
            </label>
            <label className="block text-sm">
              API key
              <input name="apiKey" required type="password" autoComplete="off" className={field} />
            </label>
          </div>
        </div>
      </Card>

      <Card title="2. Your week">
        <p className="mb-2 text-sm">Which days can you train?</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={trainingDays.includes(i)} onClick={() => toggleDay(i)} className={dayButton(trainingDays.includes(i))}>
              {d}
            </button>
          ))}
        </div>
        <p className="mb-2 mt-4 text-sm">Long-run day</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d, i) => {
            const allowed = trainingDays.includes(i);
            return (
              <button
                key={d}
                type="button"
                disabled={!allowed}
                aria-pressed={longRunDay === i}
                onClick={() => setLongRunDay(i)}
                className={`${dayButton(longRunDay === i)} disabled:opacity-30`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <label className="mt-4 block text-sm">
          Injuries or anything else the coach should know (optional)
          <textarea name="notes" rows={2} className={field} />
        </label>
      </Card>

      {error && <p className="text-sm text-critical">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !!scheduleError}>
          {busy ? "Building your plan…" : "Build my plan"}
        </Button>
        {busy ? (
          <span className="text-xs text-muted">Syncing your history and writing your first week. This takes a minute or two.</span>
        ) : (
          scheduleError && <span className="text-xs text-muted">{scheduleError}</span>
        )}
      </div>
    </form>
  );
}
