"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { createClient } from "./supabaseClient";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth(): AuthState & {
  signOut: () => Promise<{ error: AuthError | null }>;
  refresh: () => Promise<void>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    return supabase.auth.signOut();
  }, []);

  return { user, session, loading, signOut, refresh };
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signUp({ email, password });
}

export async function deleteAccount(): Promise<{ error: Error | null }> {
  // The client cannot delete auth.users directly; a server endpoint deletes
  // all habit rows (checkins cascade) and then the user via service role.
  try {
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: new Error(body.error ?? `Delete failed: ${res.status}`) };
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}
