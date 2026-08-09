"use client";

import { useRouter } from "next/navigation";
import CaptureBar from "@/components/CaptureBar";
import HouseholdBar from "@/components/HouseholdBar";
import ItemsFeed from "@/components/ItemsFeed";
import WeeklyDigest from "@/components/WeeklyDigest";
import { useHouseholdRecord } from "@/lib/household";
import { useHouseholdItems } from "@/lib/items";
import type { Identity } from "@/lib/types";

type Props = {
  code: string;
  identity: Identity;
  onLeave: () => void;
};

export default function Board({ code, identity, onLeave }: Props) {
  const router = useRouter();
  const { householdId, status } = useHouseholdRecord(code);
  const { items, loading, addItem, resolveItem, reopenItem } = useHouseholdItems(householdId);

  if (status === "not-found" || status === "error") {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This household code no longer resolves to anything. It may have been
          removed.
        </p>
        <button
          onClick={() => {
            onLeave();
            router.replace("/");
          }}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <HouseholdBar
        code={code}
        identity={identity}
        onLeave={() => {
          onLeave();
          router.replace("/");
        }}
      />
      <CaptureBar onCapture={(text) => addItem(text, identity.name, identity.color)} />
      <WeeklyDigest items={items} />
      {loading ? (
        <p className="text-sm text-zinc-400">Loading board…</p>
      ) : (
        <ItemsFeed
          items={items}
          onResolve={(id) => resolveItem(id, identity.name)}
          onReopen={reopenItem}
          currentName={identity.name}
        />
      )}
    </div>
  );
}
