"use client";

import type { Item } from "@/lib/types";
import { isSameDay, isSameWeek, relativeTime } from "@/lib/date";

type Props = {
  items: Item[];
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  currentName: string;
};

function groupItems(items: Item[]) {
  const now = new Date();
  const today: Item[] = [];
  const thisWeek: Item[] = [];
  const earlier: Item[] = [];

  for (const item of items) {
    const created = new Date(item.created_at);
    if (isSameDay(created, now)) {
      today.push(item);
    } else if (isSameWeek(created, now)) {
      thisWeek.push(item);
    } else {
      earlier.push(item);
    }
  }

  return { today, thisWeek, earlier };
}

function ItemRow({
  item,
  onResolve,
  onReopen,
  currentName,
}: {
  item: Item;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  currentName: string;
}) {
  const pending = Boolean(item.pending);
  const resolved = item.resolved && !pending;
  const stateLabel = pending
    ? "Not saved yet"
    : resolved
      ? "Mark as not done"
      : "Mark as done";

  return (
    <li
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        pending
          ? "border-dashed border-amber-400 dark:border-amber-600"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <button
        type="button"
        onClick={() => !pending && (item.resolved ? onReopen(item.id) : onResolve(item.id))}
        disabled={pending}
        aria-label={stateLabel}
        aria-pressed={resolved}
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 ${
          resolved
            ? "bg-zinc-900 dark:bg-zinc-100"
            : "border-2 border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <span
          aria-hidden="true"
          className={`block h-5 w-5 rounded-full border-2 ${
            resolved ? "border-white dark:border-black" : ""
          }`}
        />
      </button>
      <div className="flex-1">
        <p
          className={`text-sm ${
            resolved ? "text-zinc-500 line-through dark:text-zinc-400" : ""
          }`}
        >
          {item.text}
          {pending && (
            <span className="ml-2 align-middle text-xs font-medium text-amber-700 dark:text-amber-400">
              saving…
            </span>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.noticed_by_color }}
            aria-hidden="true"
          />
          {item.noticed_by === currentName ? "You" : item.noticed_by} noticed &middot;{" "}
          {relativeTime(item.created_at)}
          {resolved && item.resolved_by && (
            <>
              {" "}
              &middot; {item.resolved_by === currentName ? "you" : item.resolved_by} resolved it
            </>
          )}
        </p>
      </div>
    </li>
  );
}

export default function ItemsFeed({ items, onResolve, onReopen, currentName }: Props) {
  if (items.length === 0) {
    return (
      <p className="w-full rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Nothing noticed yet — log the first thing you&apos;re holding in your head.
      </p>
    );
  }

  const { today, thisWeek, earlier } = groupItems(items);
  const sections: [string, Item[]][] = [
    ["Today", today],
    ["This week", thisWeek],
    ["Earlier", earlier],
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {sections
        .filter(([, list]) => list.length > 0)
        .map(([label, list]) => (
          <div key={label} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {label}
            </h3>
            <ul className="flex flex-col gap-2">
              {list.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onResolve={onResolve}
                  onReopen={onReopen}
                  currentName={currentName}
                />
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
