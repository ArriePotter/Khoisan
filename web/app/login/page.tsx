"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { RACE } from "@/lib/format";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  return (
    <div className="mx-auto mt-[18vh] max-w-sm text-center">
      <h1 className="text-2xl font-semibold">Project Khoisān</h1>
      <p className="mt-2 text-sm text-ink-2">
        {RACE.name} · {RACE.distanceKm} km · {RACE.vertM.toLocaleString()} m+ · {RACE.location}
        <br />
        29 May 2027
      </p>
      <div className="mt-8">
        <Button
          onClick={() => signIn().catch((e) => setError(String(e.message ?? e)))}
          disabled={loading}
        >
          Sign in with Google
        </Button>
      </div>
      {error && <p className="mt-4 text-sm text-critical">{error}</p>}
    </div>
  );
}
