"use client";

import { useAuth } from "@/lib/auth";
import { useState } from "react";

export function AccountBar() {
  const { user, loading, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return <p className="text-xs text-ink3">Checking session…</p>;
  if (!user) return null;

  const handleDelete = async () => {
    if (!confirm("Delete your account and all habits/check-ins? This cannot be undone. Export first if you need a backup.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Delete failed");
      await signOut();
      window.location.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-ink3">Signed in as <strong className="text-ink">{user.email}</strong></span>
      <button type="button" onClick={() => void signOut()} className="rounded-lg border border-line bg-surface px-2 py-1 hover:bg-line">Sign out</button>
      <button type="button" onClick={handleDelete} disabled={busy} className="rounded-lg border border-danger bg-dangersoft px-2 py-1 text-danger hover:opacity-80 disabled:opacity-50">
        {busy ? "Deleting…" : "Delete account"}
      </button>
      {msg ? <span className="text-danger">{msg}</span> : null}
    </div>
  );
}
