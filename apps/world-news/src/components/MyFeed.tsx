"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFavourites } from "@/lib/useFavorites";
import type { CountryNews } from "@/lib/gemini";
import TimeAgo from "@/components/TimeAgo";

type Entry =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; news: CountryNews };

// Aggregates the reader's starred countries into one feed. Favourites live in
// localStorage (no login), so this fetches each followed country's summary
// client-side and shows a condensed card for it.
export default function MyFeed() {
  const { favourites } = useFavourites();
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  const codes = favourites.countries.map((c) => c.id).join(",");

  useEffect(() => {
    let active = true;
    const ids = codes ? codes.split(",") : [];
    for (const id of ids) {
      setEntries((prev) => (prev[id] ? prev : { ...prev, [id]: { status: "loading" } }));
      fetch(`/api/country/${id}`)
        .then(async (res) => {
          if (!active) return;
          if (!res.ok) {
            const msg =
              res.status === 429
                ? "Rate-limited — try again shortly."
                : res.status === 503
                  ? "News source not configured."
                  : "Couldn't load.";
            setEntries((prev) => ({ ...prev, [id]: { status: "error", message: msg } }));
            return;
          }
          const news = (await res.json()) as CountryNews;
          setEntries((prev) => ({ ...prev, [id]: { status: "ready", news } }));
        })
        .catch(() => {
          if (active) {
            setEntries((prev) => ({ ...prev, [id]: { status: "error", message: "Couldn't load." } }));
          }
        });
    }
    return () => {
      active = false;
    };
  }, [codes]);

  const hasCountries = favourites.countries.length > 0;
  const hasTopics = favourites.topics.length > 0;

  if (!hasCountries && !hasTopics) {
    return (
      <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
        <p className="font-medium text-foreground">Your feed is empty.</p>
        <p className="mt-2">
          Star a country (from its news page) or a topic to follow it. Your favourites are
          gathered here for a quick catch-up.{" "}
          <Link href="/" className="text-accent hover:underline">
            Open the globe →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasTopics && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Followed topics</p>
          <div className="flex flex-wrap gap-2">
            {favourites.topics.map((t) => (
              <Link
                key={t.id}
                href={`/topic/${t.id}`}
                className="rounded-full border border-rule bg-panel px-3 py-1 text-sm text-accent hover:border-accent"
              >
                ★ {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {hasCountries && (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-muted">Followed countries</p>
          {favourites.countries.map((c) => {
            const entry = entries[c.id];
            return (
              <section key={c.id} className="rounded-xl border border-rule bg-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/country/${c.id}`} className="text-lg font-semibold tracking-tight hover:text-accent">
                    {c.label}
                  </Link>
                  {entry?.status === "ready" && (
                    <span className="text-xs text-muted">
                      <TimeAgo iso={entry.news.generatedAt} />
                    </span>
                  )}
                </div>

                {(!entry || entry.status === "loading") && (
                  <p className="mt-3 text-sm text-muted">Loading latest…</p>
                )}
                {entry?.status === "error" && (
                  <p className="mt-3 text-sm text-red-300">{entry.message}</p>
                )}
                {entry?.status === "ready" && (
                  <div className="mt-3 space-y-3">
                    {entry.news.topics.slice(0, 2).map((t) => (
                      <div key={t.topic}>
                        <p className="text-sm font-medium text-foreground">{t.topic}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted">{t.summary}</p>
                      </div>
                    ))}
                    {entry.news.topics.length === 0 && (
                      <p className="text-sm text-muted">No significant recent news right now.</p>
                    )}
                    <Link href={`/country/${c.id}`} className="inline-block text-sm text-accent hover:underline">
                      Read all {entry.news.country} news →
                    </Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
