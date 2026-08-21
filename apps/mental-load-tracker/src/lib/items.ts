"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  convergeItems,
  createEventCoalescer,
  isRetryableWriteError,
  nextBackoffMs,
  shouldResubscribe,
} from "./connection.mjs";
import { createDiagnostics } from "./diagnostics.mjs";
import { supabase } from "./supabase";
import type { Item, Membership } from "./types";

const POLL_INTERVAL_MS = 20_000;

const diagnostics = createDiagnostics();

type PendingWrite = {
  nonce: string;
  text: string;
  createdAt: string;
  noticedBy: string;
  color: string;
};

export function useHouseholdItems(membership: Membership | null) {
  const [serverItems, setServerItems] = useState<Item[]>([]);
  const [pendingWrites, setPendingWrites] = useState<PendingWrite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [confirmedNonces, setConfirmedNonces] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const householdId = membership?.household_id ?? null;
  const pendingRef = useRef<PendingWrite[]>([]);
  const resubscribeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resubscribeAttempt = useRef(0);
  const shouldRefreshEvent = useMemo(() => createEventCoalescer(), []);

  const setPending = useCallback((next: PendingWrite[]) => {
    pendingRef.current = next;
    setPendingWrites(next);
  }, []);

  const confirmNonce = useCallback((nonce: string) => {
    setConfirmedNonces((previous) => {
      if (previous.has(nonce)) return previous;
      const next = new Set(previous);
      next.add(nonce);
      return next;
    });
  }, []);

  const items = useMemo(
    () => convergeItems(serverItems, pendingWrites, confirmedNonces),
    [serverItems, pendingWrites, confirmedNonces],
  );

  const refresh = useCallback(async () => {
    if (!supabase || !householdId) {
      setServerItems([]);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("items")
      .select("*")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });

    if (queryError) {
      diagnostics.record({
        class: "supabase-query-failure",
        context: "items:refresh",
        outcome: "error",
        code: queryError.code,
      });
      if (diagnostics.isRlsDenial(queryError.message)) {
        diagnostics.record({
          class: "rls-denied",
          context: "items:refresh",
          outcome: "denied",
        });
      }
      setError(queryError.message);
      setServerItems([]);
    } else {
      setError(null);
      setOffline(false);
      setServerItems((data ?? []) as Item[]);
    }
    setLoading(false);
  }, [householdId]);

  /** Retry queued writes oldest-first until one hard-fails or all land. */
  const flushPendingWrites = useCallback(async () => {
    if (!supabase || !householdId) return;
    let remaining = pendingRef.current;

    while (remaining.length > 0) {
      const entry = remaining[0];
      const { error: writeError } = await supabase.rpc("create_item", {
        p_household_id: householdId,
        p_text: entry.text,
        p_client_nonce: entry.nonce,
      });

      if (!writeError) {
        confirmNonce(entry.nonce);
        remaining = remaining.slice(1);
        setPending(remaining);
        continue;
      }

      const retryable = isRetryableWriteError(writeError.message);
      diagnostics.record({
        class: "write-failure",
        context: "items:create",
        outcome: retryable ? "retryable" : "permanent",
        attempt: resubscribeAttempt.current,
        pendingCount: remaining.length,
      });
      if (/rate limit/i.test(writeError.message)) {
        diagnostics.record({
          class: "rate-limited",
          context: "items:create",
          outcome: "throttled",
        });
      }
      if (retryable) {
        setOffline(true);
        break;
      }
      // Permanent rejection: drop the capture and tell the user.
      remaining = remaining.slice(1);
      setPending(remaining);
      setError(writeError.message);
      break;
    }

    if (pendingRef.current.length === 0) await refresh();
  }, [householdId, refresh, setPending, confirmNonce]);

  useEffect(() => {
    // Reset loading when the membership/household changes before fetching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Realtime is an optimization, not the security boundary. The
  // membership-derived RLS policy is evaluated by Supabase for each event;
  // polling keeps the UI responsive if Realtime is not enabled.
  useEffect(() => {
    const client = supabase;
    if (!client || !householdId) return;

    const connect = () => {
      return client
        .channel(`items:${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "items",
            filter: `household_id=eq.${householdId}`,
          },
          () => {
            // Duplicate, delayed, and out-of-order events all collapse into a
            // single authoritative refresh, so state converges regardless.
            if (shouldRefreshEvent()) void refresh();
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            resubscribeAttempt.current = 0;
            setOffline(false);
            void refresh();
            void flushPendingWrites();
          } else if (shouldResubscribe(status)) {
            diagnostics.record({
              class: "realtime-disconnect",
              context: "items:channel",
              outcome: status.toLowerCase(),
            });
            setOffline(true);
            if (resubscribeTimer.current) clearTimeout(resubscribeTimer.current);
            resubscribeTimer.current = setTimeout(
              connect,
              nextBackoffMs(resubscribeAttempt.current),
            );
            resubscribeAttempt.current += 1;
          }
        });
    };

    const channel = connect();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);

    // Sleep/wake and network switches do not always emit channel errors;
    // refresh opportunistically when the device becomes live again.
    const onOnline = () => {
      setOffline(false);
      void refresh();
      void flushPendingWrites();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      client.removeChannel(channel);
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      if (resubscribeTimer.current) clearTimeout(resubscribeTimer.current);
    };
  }, [householdId, refresh, flushPendingWrites, shouldRefreshEvent]);

  const addItem = useCallback(
    async (text: string) => {
      if (!supabase || !householdId) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const nonce = crypto.randomUUID();
      const entry: PendingWrite = {
        nonce,
        text: trimmed,
        createdAt: new Date().toISOString(),
        noticedBy: membership?.display_name ?? "You",
        color: membership?.color ?? "#6366f1",
      };
      setPending([...pendingRef.current, entry]);

      const { error: insertError } = await supabase.rpc("create_item", {
        p_household_id: householdId,
        p_text: trimmed,
        p_client_nonce: nonce,
      });

      if (!insertError) {
        confirmNonce(nonce);
        setPending(pendingRef.current.filter((candidate) => candidate.nonce !== nonce));
        await refresh();
        return;
      }

      diagnostics.record({
        class: "write-failure",
        context: "items:create",
        outcome: isRetryableWriteError(insertError.message) ? "queued" : "rejected",
        code: insertError.code,
      });
      if (isRetryableWriteError(insertError.message)) {
        // Kept in the outbox; retried on reconnect/subscription recovery.
        setOffline(true);
        return;
      }
      setPending(pendingRef.current.filter((candidate) => candidate.nonce !== nonce));
      setError(insertError.message);
      await refresh();
    },
    [
      householdId,
      membership?.color,
      membership?.display_name,
      refresh,
      setPending,
      confirmNonce,
    ],
  );

  const setResolved = useCallback(
    async (id: string, resolved: boolean) => {
      if (!supabase || id.startsWith("pending:")) return;
      const { error: updateError } = await supabase.rpc("set_item_resolved", {
        p_item_id: id,
        p_resolved: resolved,
      });
      if (updateError) {
        diagnostics.record({
          class: "write-failure",
          context: "items:resolve",
          outcome: "error",
          code: updateError.code,
        });
        setError(updateError.message);
      }
      await refresh();
    },
    [refresh],
  );

  return {
    items,
    loading,
    error,
    offline,
    unsavedCount: pendingWrites.length,
    addItem,
    resolveItem: (id: string) => setResolved(id, true),
    reopenItem: (id: string) => setResolved(id, false),
  };
}
