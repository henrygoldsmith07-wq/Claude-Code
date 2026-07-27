"use client";

interface Props {
  countByCategory: Record<string, number>;
  categoryFilter: string;
  onSelect: (category: string) => void;
}

export default function CategoryChips({ countByCategory, categoryFilter, onSelect }: Props) {
  const entries = Object.entries(countByCategory).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect("all")}
        className={`rounded-full border px-3 py-1 text-xs ${
          categoryFilter === "all"
            ? "border-foreground bg-foreground text-background"
            : "border-line text-ink2"
        }`}
      >
        All
      </button>
      {entries.map(([cat, count]) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`rounded-full border px-3 py-1 text-xs ${
            categoryFilter === cat
              ? "border-foreground bg-foreground text-background"
              : "border-line text-ink2"
          }`}
        >
          {cat} ({count})
        </button>
      ))}
    </div>
  );
}
