"use client";

import { Card, PersonalBests } from "@/components/ui";
import { useRequireAthlete } from "@/lib/auth";
import { useAllStats } from "@/lib/data";

export default function PersonalPage() {
  const { user, athlete, loading } = useRequireAthlete();
  const stats = useAllStats()?.find((s) => s.id === user?.uid);
  if (loading || !athlete) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Personal</h1>
      <Card title="Personal bests">
        <PersonalBests stats={stats} />
      </Card>
    </div>
  );
}
