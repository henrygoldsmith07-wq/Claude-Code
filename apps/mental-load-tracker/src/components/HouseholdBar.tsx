"use client";

import { useState } from "react";
import type { Identity } from "@/lib/types";

type Props = {
  code: string;
  identity: Identity;
  onLeave: () => void;
};

export default function HouseholdBar({ code, identity, onLeave }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <span
          className="h-6 w-6 shrink-0 rounded-full"
          style={{ backgroundColor: identity.color }}
        />
        <span className="text-sm font-medium">{identity.name}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">Household code</span>
        <button
          onClick={handleCopy}
          className="rounded-md border border-zinc-300 px-2 py-1 font-mono tracking-widest transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {copied ? "Copied!" : code}
        </button>
        <button
          onClick={onLeave}
          className="text-zinc-400 underline-offset-2 hover:underline dark:text-zinc-500"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
