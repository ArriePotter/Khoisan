"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, db } from "./firebase";
import type { Athlete } from "./types";

interface AuthState {
  user: User | null;
  athlete: Athlete | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [athleteReady, setAthleteReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setAuthReady(true);
    if (!u) {
      setAthlete(null);
      setAthleteReady(true);
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    setAthleteReady(false);
    return onSnapshot(
      doc(db, "athletes", user.uid),
      (snap) => {
        setAthlete(snap.exists() ? (snap.data() as Athlete) : null);
        setAthleteReady(true);
      },
      () => setAthleteReady(true),
    );
  }, [user]);

  const value: AuthState = {
    user,
    athlete,
    loading: !authReady || !athleteReady,
    signIn: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut: () => signOut(auth),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/** Sends signed-out users to /login and unconnected users to /setup. */
export function useRequireAthlete() {
  const state = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (state.loading) return;
    if (!state.user) router.replace("/login/");
    else if (!state.athlete && !path.startsWith("/setup")) router.replace("/setup/");
  }, [state.loading, state.user, state.athlete, router, path]);
  return state;
}
