"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthError, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthState = {
  session: Session | null;
  loading: boolean;
};

export function useAuth(): AuthState & {
  signOut: () => Promise<{ error: AuthError | null }>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      // The configured-client check is the one-time browser bootstrap.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    let mounted = true;

    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return { error: null };
    return supabase.auth.signOut();
  }, []);

  return { session, loading, signOut };
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string) {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  return supabase.auth.signUp({ email, password });
}
