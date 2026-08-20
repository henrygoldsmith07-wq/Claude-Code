"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { HouseholdRole, Membership } from "./types";

const MEMBERSHIP_REFRESH_MS = 10_000;

type MembershipRow = {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  display_name: string;
  color: string;
  created_at: string;
  updated_at: string;
  households:
    | { name: string }
    | { name: string }[]
    | null;
};

function normalizeMembership(row: MembershipRow): Membership {
  const household = Array.isArray(row.households) ? row.households[0] : row.households;
  return {
    household_id: row.household_id,
    household_name: household?.name ?? "Our household",
    user_id: row.user_id,
    role: row.role,
    display_name: row.display_name,
    color: row.color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useCurrentMembership(preferredHouseholdId: string | null = null) {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setMembership(null);
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setMembership(null);
      setError(null);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("household_memberships")
      .select(
        "household_id,user_id,role,display_name,color,created_at,updated_at,households!inner(name)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (preferredHouseholdId) {
      query = query.eq("household_id", preferredHouseholdId);
    }

    const { data, error: queryError } = await query;
    if (queryError) {
      setError(queryError.message);
      setMembership(null);
    } else {
      setError(null);
      const row = (data?.[0] ?? null) as MembershipRow | null;
      setMembership(row ? normalizeMembership(row) : null);
    }
    setLoading(false);
  }, [preferredHouseholdId]);

  useEffect(() => {
    let cancelled = false;
    // Reset loading when the selected membership changes before fetching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    refresh().then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let userId: string | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<typeof client.channel> | null = null;
    let disposed = false;

    client.auth.getUser().then(({ data }) => {
      if (disposed || !data.user) return;
      userId = data.user.id;
      channel = client
        .channel(`membership:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "household_memberships",
            filter: `user_id=eq.${userId}`,
          },
          () => refresh(),
        )
        .subscribe();
      interval = setInterval(refresh, MEMBERSHIP_REFRESH_MS);
    });

    return () => {
      disposed = true;
      if (channel) client.removeChannel(channel);
      if (interval) clearInterval(interval);
    };
  }, [refresh]);

  return { membership, loading, error, refresh };
}
