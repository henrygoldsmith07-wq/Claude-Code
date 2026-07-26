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

export default function MyFeed() {
  const { favourites, pins, removePin } = useFavourites();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [digest, setDigest] = useState<string | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);

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
  const hasPins = pins.length > 0;

  const generateDigest = async () => {
    const places = [
      ...favourites.countries.map((c) => c.label),
      ...pins.map((p) => p.label),
    ];
    if (places.length === 0) return;
    setDigestBusy(true);
    setDigest(null);
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ places }),
      });
      const data = await res.json();
      setDigest(typeof data.digest === "string" ? data.digest : "Could not generate digest.");
    } catch {
      setDigest("Network error — try again shortly.");
    } finally {
      setDigestBusy(false);
    }
  };

  if (!hasCountries && !hasTopics && !hasPins) {
    return (
      <div className="rounded-xl border border-rule bg-panel p-5 text-sm text-muted">
        <p className="font-medium text-foreground">Your feed is empty.</p>
        <p className="mt-2">
          Star a country (from its news page), follow a topic, or drop a pin on the globe.
          Your favourites and pins are gathered here for a quick catch-up.{" "}
          <Link href="/" className="text-accent hover:underline">
            Open the globe →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(hasCountries || hasPins) && (
        <div className="rounded-xl border border-rule bg-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Daily Digest</p>
              <p className="text-xs text-muted">
                AI summary of the places you follow and have pinned
              </p>
            </div>
            <button
              type="button"
              onClick={generateDigest}
              disabled={digestBusy}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {digestBusy ? "Generating…" : "Generate"}
            </button>
          </div>
          {digest && (
            <div className="mt-3 whitespace-pre-wrap rounded-lg bg-panel-soft p-3 text-sm leading-relaxed text-muted">
              {digest}
            </div>
          )}
        </div>
      )}

      {hasPins && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Your pins</p>
          <div className="flex flex-wrap gap-2">
            {pins.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-sm text-violet-200"
              >
                📌 {p.label}
                <button
                  type="button"
                  onClick={() => removePin(p.id)}
                  className="text-violet-300/70 hover:text-red-300"
                  title="Remove pin"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

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
