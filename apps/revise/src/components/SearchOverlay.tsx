"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { allTopics } from "@/domain/curriculum";
import { buildSearchIndex, searchIndex } from "@/domain/search";
import type { SearchResult } from "@/domain/search";
import { useStore } from "@/state/store";
import { cx, Pill } from "./ui";

/** ⌘K search across topics, cards and questions. Runs locally, so it works
 *  offline and returns within a keystroke. */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { cards, questions, settings } = useStore();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Indexed once per corpus change so each keystroke is a scan of prepared
  // strings rather than a re-lower-casing of the whole deck.
  const index = useMemo(
    () => buildSearchIndex({ topics: allTopics(settings.subjectIds), cards, questions }),
    [cards, questions, settings.subjectIds],
  );
  const results = useMemo(() => searchIndex(index, query, 20), [index, query]);

  useEffect(() => inputRef.current?.focus(), []);

  const open = (result: SearchResult) => {
    onClose();
    if (result.kind === "question") router.push(`/practice?question=${encodeURIComponent(result.id)}`);
    else if (result.kind === "card") router.push(`/review?topic=${encodeURIComponent(result.topicId ?? "")}`);
    else router.push(`/library?topic=${encodeURIComponent(result.id)}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start justify-center p-4 sm:pt-24"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="card elev-pop w-full max-w-xl overflow-hidden fade-in motion-safe:fade-in" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Reset the highlight with the query, in the same event, so the
            // list never renders with a cursor pointing past its own end.
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") setCursor((c) => Math.min(results.length - 1, c + 1));
            if (e.key === "ArrowUp") setCursor((c) => Math.max(0, c - 1));
            if (e.key === "Enter" && results[cursor]) open(results[cursor]);
          }}
          placeholder="Search topics, cards and questions…"
          className="w-full bg-transparent px-4 py-3.5 text-sm outline-none border-b border-line"
          aria-label="Search query"
          aria-controls="search-results"
          aria-activedescendant={results[cursor] ? `search-result-${results[cursor].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <ul id="search-results" className="max-h-[60vh] overflow-y-auto nice-scroll cv-list" role="listbox" aria-label="Search results">
          {results.map((result, i) => (
            <li key={`${result.kind}:${result.id}`}>
              <button
                id={`search-result-${result.id}`}
                role="option"
                aria-selected={i === cursor}
                onClick={() => open(result)}
                onMouseEnter={() => setCursor(i)}
                className={cx(
                  "w-full text-left px-4 py-2.5 border-b border-line last:border-0",
                  i === cursor && "bg-surface2",
                )}
              >
                <div className="flex items-start gap-2">
                  <Pill className="mt-0.5 shrink-0">{result.kind}</Pill>
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{result.title}</p>
                    <p className="text-xs text-ink3 truncate">{result.snippet}</p>
                  </div>
                </div>
              </button>
            </li>
          ))}
          {query.length >= 2 && !results.length ? (
            <li className="px-4 py-6 text-center text-sm text-ink3" role="status" aria-live="polite">
              Nothing matches “{query}”.
            </li>
          ) : null}
          {query.length < 2 ? (
            <li className="px-4 py-5">
              <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mb-2">Try</p>
              <div className="flex flex-wrap gap-1.5">
                {["photosynthesis", "moles", "momentum", "enzymes", "integration"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                      setCursor(0);
                    }}
                    className="pill hover:border-ink3 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink3 mt-3">
                {index.docs.length} items indexed on this device — search works offline.
              </p>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
