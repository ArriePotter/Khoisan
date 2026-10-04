"use client";

import { collection, limit, onSnapshot, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import type { Activity, Adjustment, CompareStats, Wellness, WeekPlan } from "./types";

function useCollection<T>(path: string | null, constraints: QueryConstraint[], deps: unknown[], withId = false): T[] | null {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      query(collection(db, path), ...constraints),
      (snap) => setRows(snap.docs.map((d) => (withId ? { id: d.id, ...d.data() } : d.data()) as T)),
      (err) => {
        console.error(path, err);
        setRows([]);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return rows;
}

export const useWeeks = (uid: string | undefined) =>
  useCollection<WeekPlan>(uid ? `athletes/${uid}/weeks` : null, [orderBy("weekStart")], []);

export const useActivities = (uid: string | undefined, since: string) =>
  useCollection<Activity>(uid ? `athletes/${uid}/activities` : null, [where("date", ">=", since), orderBy("date")], [since]);

export const useWellness = (uid: string | undefined, since: string) =>
  useCollection<Wellness>(uid ? `athletes/${uid}/wellness` : null, [where("date", ">=", since), orderBy("date")], [since]);

export const useAdjustments = (uid: string | undefined, max = 30) =>
  useCollection<Adjustment>(uid ? `athletes/${uid}/adjustments` : null, [orderBy("createdAt", "desc"), limit(max)], [max], true);

export const useAllStats = () => useCollection<CompareStats & { id: string }>("stats", [], [], true);
