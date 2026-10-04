"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { raceCountdown } from "@/lib/format";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/plan/", label: "Plan" },
  { href: "/personal/", label: "Personal" },
  { href: "/compare/", label: "Compare" },
];

export function Nav() {
  const path = usePathname();
  const { user, athlete, signOut } = useAuth();
  const [left, setLeft] = useState(() => raceCountdown());
  useEffect(() => {
    const t = setInterval(() => setLeft(raceCountdown()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!user || !athlete) return null;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-page/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href="/" className="flex items-baseline gap-2 font-semibold">
            Project Khoisān
            <span className="text-sm font-normal text-ink-2 tabular">
              {left.days} days {left.hours} h to MUT 60
            </span>
          </Link>
          <nav className="ml-auto hidden gap-1 sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${active(l.href) ? "bg-surface-2 font-medium" : "text-ink-2 hover:bg-surface-2"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <button onClick={signOut} className="ml-auto text-sm text-ink-2 hover:text-ink sm:ml-0">
            Sign out
          </button>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`flex-1 py-3 text-center text-sm ${active(l.href) ? "font-semibold" : "text-ink-2"}`}>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
