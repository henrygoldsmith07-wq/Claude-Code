"use client";

import { useEffect, useState } from "react";
import { createHousehold, useHouseholdRecord } from "@/lib/household";
import { normalizeHouseholdCode } from "@/lib/code";
import { IDENTITY_COLORS } from "@/lib/types";

type Props = {
  onJoin: (code: string, name: string, color: string) => void;
};

export default function OnboardingForm({ onJoin }: Props) {
  const [mode, setMode] = useState<"start" | "join">("start");
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(IDENTITY_COLORS[0]);
  const [joinCode, setJoinCode] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { status } = useHouseholdRecord(pendingCode);
  const lookupFailed = pendingCode !== null && (status === "not-found" || status === "error");
  const displayError =
    error ??
    (lookupFailed ? "No household found with that code. Double-check it and try again." : null);

  useEffect(() => {
    if (pendingCode && status === "ready") {
      onJoin(pendingCode, name.trim(), color);
    }
  }, [pendingCode, status, onJoin, name, color]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setError(null);
    setSubmitting(true);

    if (mode === "start") {
      const code = await createHousehold();
      setSubmitting(false);
      if (!code) {
        setError("Couldn't create a household. Check your Supabase setup and try again.");
        return;
      }
      onJoin(code, trimmedName, color);
      return;
    }

    const normalized = normalizeHouseholdCode(joinCode);
    if (!normalized) {
      setSubmitting(false);
      setError("Enter the household code your partner shared with you.");
      return;
    }
    setPendingCode(normalized);
    setSubmitting(false);
  }

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
            mode === "start"
              ? "bg-white shadow-sm dark:bg-zinc-800"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Start a household
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded-md py-2 transition ${
            mode === "join"
              ? "bg-white shadow-sm dark:bg-zinc-800"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          Join a household
        </button>
      </div>

      {mode === "join" && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Household code</span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="e.g. K7P2QX"
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 uppercase tracking-widest focus:border-zinc-500 focus:outline-none dark:border-zinc-700"
            maxLength={12}
          />
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
                color === c ? "ring-2 ring-offset-2 ring-zinc-900 dark:ring-offset-black dark:ring-zinc-100" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {displayError && (
        <p className="text-sm text-red-600 dark:text-red-400">{displayError}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !name.trim() || (mode === "join" && !joinCode.trim())}
        className="rounded-md bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting
          ? "One sec..."
          : mode === "start"
            ? "Create household"
            : "Join household"}
      </button>
    </form>
  );
}
