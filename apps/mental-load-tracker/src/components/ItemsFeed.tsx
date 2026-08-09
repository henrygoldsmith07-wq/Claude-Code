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
  return (
    <li className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <button
        onClick={() => (item.resolved ? onReopen(item.id) : onResolve(item.id))}
        aria-label={item.resolved ? "Mark as not done" : "Mark as done"}
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 transition ${
          item.resolved
            ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      />
      <div className="flex-1">
        <p
          className={`text-sm ${
            item.resolved ? "text-zinc-400 line-through dark:text-zinc-600" : ""
          }`}
        >
          {item.text}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: item.noticed_by_color }}
          />
          {item.noticed_by === currentName ? "You" : item.noticed_by} noticed &middot;{" "}
          {relativeTime(item.created_at)}
          {item.resolved && item.resolved_by && (
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
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
