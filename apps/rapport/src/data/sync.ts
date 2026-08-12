import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { open, seal } from "./crypto";
import type { SealedPayload } from "./crypto";
import * as repo from "./repository";
import type { DomainEvent } from "@/domain/events";
import type { Snapshot } from "@/domain/types";

// ---------------------------------------------------------------------------
// Optional sync.
//
// One row per user holding one sealed blob. The server sees ciphertext, an IV,
// a salt and a timestamp — it cannot read a single reflection, skill estimate
// or goal, and the row-level security policy means it cannot serve them to
// anyone but the row's owner either.
//
// Conflict handling is last-writer-wins on the whole blob, which is the honest
// choice for this data: there is no field-level merge that produces a coherent
// training history, and pretending otherwise would silently corrupt it. The UI
// shows both timestamps and asks, rather than resolving quietly.
// ---------------------------------------------------------------------------

export interface SyncRow {
  user_id: string;
  payload: SealedPayload;
  updated_at: string;
  /** Scoring-model version at write time, so a newer client can recompute. */
  version: number;
}

let client: SupabaseClient | null = null;

export function isSyncConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getClient(): SupabaseClient | null {
  if (!isSyncConfigured()) return null;
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: true, autoRefreshToken: true } },
    );
  }
  return client;
}

export type SyncOutcome =
  | { status: "disabled" }
  | { status: "signed-out" }
  | { status: "pushed"; at: string }
  | { status: "pulled"; at: string }
  | { status: "conflict"; localAt: string; remoteAt: string }
  | { status: "error"; message: string };

export interface SyncState {
  lastSyncedAt: string | null;
  /** Set when a pull would overwrite newer local data. Resolved by the user. */
  pendingConflict: { localAt: string; remoteAt: string } | null;
}

/**
 * Push local state up. Everything is sealed on this device first; the
 * passphrase is passed in per call and never stored.
 */
export async function push(passphrase: string, now: string): Promise<SyncOutcome> {
  const supabase = getClient();
  if (!supabase) return { status: "disabled" };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "signed-out" };

  try {
    const payload = await repo.exportAll(now);
    const sealed = await seal(payload, passphrase);
    const { error } = await supabase.from("rapport_state").upsert({
      user_id: auth.user.id,
      payload: sealed,
      updated_at: now,
      version: payload.version,
    });
    if (error) return { status: "error", message: error.message };
    return { status: "pushed", at: now };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Pull remote state down. Refuses silently to clobber newer local data —
 * `force` exists so the user can make that choice explicitly.
 */
export async function pull(passphrase: string, now: string, options: { force?: boolean; localUpdatedAt?: string } = {}): Promise<SyncOutcome> {
  const supabase = getClient();
  if (!supabase) return { status: "disabled" };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "signed-out" };

  try {
    const { data, error } = await supabase
      .from("rapport_state")
      .select("payload, updated_at, version")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) return { status: "error", message: error.message };
    if (!data) return { status: "pulled", at: now };

    const row = data as Pick<SyncRow, "payload" | "updated_at" | "version">;
    if (!options.force && options.localUpdatedAt && options.localUpdatedAt > row.updated_at) {
      return { status: "conflict", localAt: options.localUpdatedAt, remoteAt: row.updated_at };
    }

    const decrypted = await open<{ snapshot: Snapshot; events: DomainEvent[] }>(row.payload, passphrase);
    await repo.importAll(decrypted, now);
    return { status: "pulled", at: now };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A decryption failure is almost always a wrong passphrase; say that rather
    // than surfacing a WebCrypto error.
    if (/operation-specific reason|decrypt/i.test(message)) {
      return { status: "error", message: "Could not decrypt the synced copy. Check the passphrase — it is the one you set when enabling sync." };
    }
    return { status: "error", message };
  }
}

/** Remove the synced copy. Local data is untouched. */
export async function deleteRemote(): Promise<SyncOutcome> {
  const supabase = getClient();
  if (!supabase) return { status: "disabled" };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "signed-out" };
  const { error } = await supabase.from("rapport_state").delete().eq("user_id", auth.user.id);
  if (error) return { status: "error", message: error.message };
  return { status: "pushed", at: new Date().toISOString() };
}

export async function signInWithEmail(email: string): Promise<{ ok: boolean; message: string }> {
  const supabase = getClient();
  if (!supabase) return { ok: false, message: "Sync is not configured for this deployment." };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/settings` : undefined },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Check your email for a sign-in link." };
}

export async function signOut(): Promise<void> {
  const supabase = getClient();
  if (supabase) await supabase.auth.signOut();
}

export async function currentEmail(): Promise<string | null> {
  const supabase = getClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}
