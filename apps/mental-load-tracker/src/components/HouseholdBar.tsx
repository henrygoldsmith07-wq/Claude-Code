"use client";

import type { Membership } from "@/lib/types";

type Props = {
  membership: Membership;
  onSignOut: () => void;
};

export default function HouseholdBar({ membership, onSignOut }: Props) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <span
          className="h-6 w-6 shrink-0 rounded-full"
          style={{ backgroundColor: membership.color }}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium">{membership.display_name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {membership.household_name} · {membership.role}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="min-h-11 px-1 text-sm text-zinc-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-300 dark:focus-visible:outline-zinc-100"
      >
        Sign out
      </button>
    </div>
  );
}
