"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Item } from "./types";

const POLL_INTERVAL_MS = 20_000;

export function useHouseholdItems(householdId: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Item[]);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    refresh();
  }, [refresh]);

  // Realtime keeps both partners' boards in sync live; polling is a fallback
  // for households that haven't enabled Realtime replication on `items`.
  useEffect(() => {
    const client = supabase;
    if (!client || !householdId) return;

    const channel = client
      .channel(`items:${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `household_id=eq.${householdId}` },
        () => refresh()
      )
      .subscribe();

    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      client.removeChannel(channel);
      clearInterval(interval);
    };
  }, [householdId, refresh]);

  const addItem = useCallback(
    async (text: string, name: string, color: string) => {
      if (!supabase || !householdId) return;
      await supabase.from("items").insert({
        household_id: householdId,
        text,
        noticed_by: name,
        noticed_by_color: color,
      });
      refresh();
    },
    [householdId, refresh]
  );

  const resolveItem = useCallback(
    async (id: string, name: string) => {
      if (!supabase) return;
      await supabase
        .from("items")
        .update({ resolved: true, resolved_by: name, resolved_at: new Date().toISOString() })
        .eq("id", id);
      refresh();
    },
    [refresh]
  );

  const reopenItem = useCallback(
    async (id: string) => {
      if (!supabase) return;
      await supabase
        .from("items")
        .update({ resolved: false, resolved_by: null, resolved_at: null })
        .eq("id", id);
      refresh();
    },
    [refresh]
  );

  return { items, loading, addItem, resolveItem, reopenItem };
}
