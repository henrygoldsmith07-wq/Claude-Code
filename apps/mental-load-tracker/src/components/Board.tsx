"use client";

import CaptureBar from "@/components/CaptureBar";
import HouseholdBar from "@/components/HouseholdBar";
import InvitePanel from "@/components/InvitePanel";
import ItemsFeed from "@/components/ItemsFeed";
import WeeklyDigest from "@/components/WeeklyDigest";
import { useHouseholdItems } from "@/lib/items";
import type { Membership } from "@/lib/types";

type Props = {
  membership: Membership;
  onSignOut: () => void;
};

export default function Board({ membership, onSignOut }: Props) {
  const { items, loading, error, addItem, resolveItem, reopenItem } = useHouseholdItems(membership);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <HouseholdBar membership={membership} onSignOut={onSignOut} />
      {membership.role === "owner" && <InvitePanel householdId={membership.household_id} />}
      <CaptureBar onCapture={addItem} />
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          We could not sync this household. Your access may have been removed; sign out and sign in again.
        </p>
      )}
      <WeeklyDigest items={items} />
      {loading ? (
        <p className="text-sm text-zinc-400">Loading board…</p>
      ) : (
        <ItemsFeed
          items={items}
          onResolve={resolveItem}
          onReopen={reopenItem}
          currentName={membership.display_name}
        />
      )}
    </div>
  );
}
