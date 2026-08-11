"use client";

import { useMemo, useState } from "react";
import type { Entry } from "@/lib/types";
import { encryptJson, decryptJson, passphraseStrength, type EncryptedBlob } from "@/lib/crypto";
import { isPulseOptIn, setPulseOptIn, emitPulse } from "@/lib/pulse";

const VAULT_KEY = "reflectVault";
const ENTRIES_KEY = "reflectEntries";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function PrivacyBar({
  entries,
  setEntries,
}: {
  entries: Entry[];
  setEntries: (v: Entry[] | ((c: Entry[]) => Entry[])) => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [localOnly, setLocalOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("reflectLocalOnly") === "1";
  });
  const [pulseOn, setPulseOn] = useState(() => isPulseOptIn());
  const strength = useMemo(() => passphraseStrength(passphrase), [passphrase]);
  const hasVault = typeof window !== "undefined" && !!window.localStorage.getItem(VAULT_KEY);

  function persistLocalOnly(v: boolean) {
    setLocalOnly(v);
    try {
      if (v) window.localStorage.setItem("reflectLocalOnly", "1");
      else window.localStorage.removeItem("reflectLocalOnly");
    } catch {}
  }

  async function handleEncrypt() {
    if (passphrase.length < 8) return;
    const blob = await encryptJson(passphrase, entries);
    try {
      window.localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
      // keep entries in place too — vault is a backup/encryption layer for export hygiene;
      // clearing plaintext is the "Encrypt & clear" action below.
    } catch (e) {
      alert(`Could not save vault: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleDecrypt() {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (!raw) return;
    try {
      const blob = JSON.parse(raw) as EncryptedBlob;
      const data = await decryptJson<Entry[]>(passphrase, blob);
      setEntries(data);
    } catch {
      alert("Wrong passphrase or corrupted vault.");
    }
  }

  function handleExport() {
    downloadJson(`reflect-export-${new Date().toISOString().slice(0, 10)}.json`, entries);
  }

  async function handleExportEncrypted() {
    if (passphrase.length < 8) { alert("Enter a passphrase first."); return; }
    const blob = await encryptJson(passphrase, entries);
    downloadJson(`reflect-export-encrypted-${new Date().toISOString().slice(0, 10)}.json`, blob);
  }

  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        // Encrypted blob vs plain array
        if (parsed && parsed.v === 1 && parsed.ct) {
          alert("This looks like an encrypted export — use Decrypt vault with its passphrase, or decrypt offline and import the plaintext JSON.");
          return;
        }
        if (!Array.isArray(parsed)) throw new Error("Expected an array of reflections");
        setEntries(parsed as Entry[]);
      } catch (e) {
        alert(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    reader.readAsText(file);
  }

  function handleDeleteAll() {
    if (!confirm("Delete all reflections from this browser? This cannot be undone (export first if needed).")) return;
    setEntries([]);
    try {
      window.localStorage.removeItem(ENTRIES_KEY);
      window.localStorage.removeItem(VAULT_KEY);
    } catch {}
  }

  function handleEncryptAndClear() {
    handleEncrypt().then(() => {
      if (!confirm("Vault saved. Clear plaintext reflections from this browser now? You can restore with the same passphrase.")) return;
      setEntries([]);
      try { window.localStorage.removeItem(ENTRIES_KEY); } catch {}
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Privacy · Export · Encryption</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Stored only in this browser. <span className="font-medium text-foreground">Local-only mode</span> skips the AI reflection API entirely (you still get the structured trace form). Vault uses WebCrypto AES-GCM + PBKDF2 — all client-side.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={localOnly} onChange={(e) => persistLocalOnly(e.target.checked)} />
          Local-only mode
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={pulseOn}
            onChange={(e) => {
              setPulseOn(e.target.checked);
              setPulseOptIn(e.target.checked);
              if (e.target.checked) emitPulse(entries);
            }}
          />
          Pulse (aggregated counts only) — explicit opt-in
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Vault passphrase</span>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="at least 8 characters"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
          />
          <span className={`text-xs ${strength.score >= 2 ? "text-emerald-600" : strength.score === 1 ? "text-amber-600" : "text-muted"}`}>
            {passphrase ? strength.label : " "}
          </span>
        </label>
        <button onClick={handleEncrypt} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover">Save vault</button>
        {hasVault && <button onClick={handleDecrypt} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover">Restore vault</button>}
        <button onClick={handleEncryptAndClear} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover">Encrypt & clear plaintext</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={handleExport} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">Export JSON</button>
        <button onClick={handleExportEncrypted} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover">Export encrypted</button>
        <label className="cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover">
          Import JSON
          <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.currentTarget.value = ""; }} />
        </label>
        <button onClick={handleDeleteAll} className="rounded-lg border border-danger/30 bg-dangersoft px-3 py-1.5 text-xs font-medium text-danger hover:brightness-95">Delete all data</button>
      </div>
      {localOnly && <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700">Local-only is on — new reflections won&apos;t call the AI. You can still use the structured trace and fill summaries manually; rerunning via API requires turning this off.</p>}
    </div>
  );
}
