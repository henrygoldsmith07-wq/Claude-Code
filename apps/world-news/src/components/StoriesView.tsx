"use client";

import { useMemo, useState } from "react";
import type { StoryCluster } from "@/lib/storyModel";
import StoryClusterCard from "./StoryClusterCard";
import SearchAndFilters from "./SearchAndFilters";

function significanceOf(s: StoryCluster): number {
  return typeof s.significance === "number" ? s.significance : -1;
}

export default function StoriesView({ stories }: { stories: StoryCluster[] }) {
  const [filteredIds, setFilteredIds] = useState<string[] | null>(null);

  const sorted = useMemo(() => {
    const hasSig = stories.some((s) => typeof s.significance === "number");
    if (!hasSig) return stories;
    return [...stories].sort((a, b) => significanceOf(b) - significanceOf(a));
  }, [stories]);

  const visible = useMemo(() => {
    if (!filteredIds) return sorted;
    const set = new Set(filteredIds);
    return sorted.filter((s) => set.has(s.id));
  }, [sorted, filteredIds]);

  const hasSignificance = stories.some((s) => typeof s.significance === "number");

  return (
    <div className="space-y-3">
      <SearchAndFilters stories={stories} onFiltered={setFilteredIds} />
      {hasSignificance && (
        <p className="text-[11px] text-muted">
          Ranked by editorial significance (corroboration · geography · primary sources · recency) — not popularity.
        </p>
      )}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule bg-panel-soft p-4 text-sm text-muted">
          No stories match those filters. Try clearing the search or switching topic/country.
        </p>
      ) : (
        <div className="space-y-4">
          {visible.map((s) => (
            <StoryClusterCard key={s.id} story={s} />
          ))}
        </div>
      )}
      {filteredIds && visible.length > 0 && visible.length < sorted.length && (
        <p className="text-xs text-muted">
          Showing {visible.length} of {sorted.length} stories.
        </p>
      )}
    </div>
  );
}
