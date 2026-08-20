"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Item, Membership } from "./types";

const POLL_INTERVAL_MS = 20_000;

export function useHouseholdItems(membership: Membership | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const householdId = membership?.household_id ?? null;

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("items")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else {
      setError(null);
      setItems((data ?? []) as Item[]);
    }
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    // Reset loading when the membership/household changes before fetching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Realtime is an optimization, not the security boundary. The household
  // membership-derived RLS policy is evaluated by Supabase for each event;
  // polling keeps the UI responsive if Realtime is not enabled.
  useEffect(() => {
    const client = supabase;
    if (!client || !householdId) return;

    const channel = client
      .channel(`items:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `household_id=eq.${householdId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);

    return () => {
      client.removeChannel(channel);
      clearInterval(interval);
    };
  }, [householdId, refresh]);

  const addItem = useCallback(
    async (text: string) => {
      if (!supabase || !householdId) return;
      const { error: insertError } = await supabase.rpc("create_item", {
        p_household_id: householdId,
        p_text: text,
      });
      if (insertError) setError(insertError.message);
      await refresh();
    },
    [householdId, refresh],
  );

  const setResolved = useCallback(
    async (id: string, resolved: boolean) => {
      if (!supabase) return;
      const { error: updateError } = await supabase.rpc("set_item_resolved", {
        p_item_id: id,
        p_resolved: resolved,
      });
      if (updateError) setError(updateError.message);
      await refresh();
    },
    [refresh],
  );

  return {
    items,
    loading,
    error,
    addItem,
    resolveItem: (id: string) => setResolved(id, true),
    reopenItem: (id: string) => setResolved(id, false),
  };
}
