"use client";

import { useState } from "react";
import {
  acceptHouseholdInvitation,
  claimLegacyHousehold,
  createHousehold,
} from "@/lib/household";
import { IDENTITY_COLORS } from "@/lib/types";

type Props = {
  initialInvitationToken?: string | null;
  onComplete: (householdId: string) => void;
};

type Mode = "start" | "invite" | "legacy";

function invitationTokenFromInput(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return (
      new URLSearchParams(url.hash.replace(/^#/, "")).get("invite") ??
      url.searchParams.get("invite") ??
      trimmed
    );
  } catch {
    return trimmed;
  }
}

export default function OnboardingForm({ initialInvitationToken, onComplete }: Props) {
  const [mode, setMode] = useState<Mode>(initialInvitationToken ? "invite" : "start");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(IDENTITY_COLORS[0]);
  const [invitationToken, setInvitationToken] = useState(initialInvitationToken ?? "");
  const [legacyCode, setLegacyCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || submitting) return;
    setError(null);
    setSubmitting(true);

    const result =
      mode === "start"
        ? await createHousehold(trimmedName, color)
        : mode === "invite"
          ? await acceptHouseholdInvitation(
              invitationTokenFromInput(invitationToken),
              trimmedName,
              color,
            )
          : await claimLegacyHousehold(legacyCode.trim(), trimmedName, color);

    setSubmitting(false);
    if (result.error || !result.data) {
      setError(
        mode === "legacy"
          ? result.error ?? "That legacy household could not be migrated."
          : result.error ?? "Could not join this household.",
      );
      return;
    }

    onComplete(result.data.householdId);
  }

  const buttonLabel =
    mode === "start" ? "Create household" : mode === "invite" ? "Join household" : "Migrate household";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex rounded-lg bg-zinc-100 p-1 text-sm font-medium dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setMode("start")}
          className={`flex-1 rounded-md py-2 transition ${
            mode === "start" ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => setMode("invite")}
          className={`flex-1 rounded-md py-2 transition ${
            mode === "invite" ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Join with invite
        </button>
      </div>

      {mode === "invite" && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Invitation token</span>
          <input
            value={invitationToken}
            onChange={(e) => setInvitationToken(e.target.value)}
            placeholder="Paste the invite link token"
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs focus:border-zinc-500 focus:outline-none dark:border-zinc-700"
            maxLength={64}
            required
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Invitations expire after 7 days and can be revoked by the owner.
          </span>
        </label>
      )}

      {mode === "legacy" && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Old household code</span>
          <input
            value={legacyCode}
            onChange={(e) => setLegacyCode(e.target.value.toUpperCase())}
            placeholder="Only for an existing v1 household"
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 uppercase tracking-widest focus:border-zinc-500 focus:outline-none dark:border-zinc-700"
            maxLength={32}
            required
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            This one-time migration makes your authenticated account the new owner.
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Jordan"
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 focus:border-zinc-500 focus:outline-none dark:border-zinc-700"
          maxLength={30}
          required
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Your color</span>
        <div className="flex gap-2">
          {IDENTITY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Choose color ${c}`}
              className={`h-8 w-8 rounded-full transition ${
                color === c
                  ? "ring-2 ring-offset-2 ring-zinc-900 dark:ring-offset-black dark:ring-zinc-100"
                  : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {mode !== "legacy" && (
        <button
          type="button"
          onClick={() => setMode("legacy")}
          className="self-start text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Migrate an existing household code
        </button>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={
          submitting ||
          !name.trim() ||
          (mode === "invite" && !invitationToken.trim()) ||
          (mode === "legacy" && !legacyCode.trim())
        }
        className="rounded-md bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "One sec…" : buttonLabel}
      </button>
    </form>
  );
}
