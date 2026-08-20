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
        />
        <div>
          <p className="text-sm font-medium">{membership.display_name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {membership.household_name} · {membership.role}
          </p>
        </div>
      </div>
      <button
        onClick={onSignOut}
        className="text-sm text-zinc-400 underline-offset-2 hover:underline dark:text-zinc-500"
      >
        Sign out
      </button>
    </div>
  );
}
