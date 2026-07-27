"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFavourites } from "@/lib/useFavorites";
import { dotColor } from "@/lib/topicColors";

interface TopicLink {
  topic: string;
  slug: string;
  emoji: string;
}

// Left navigation sidebar: app title, worldwide link, topic globes, and the
// user's starred countries/topics. Collapsible (useful on narrow screens).
export default function Sidebar({
  topics,
  activeSlug,
}: {
  topics: TopicLink[];
  activeSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const { favourites } = useFavourites();

  // Open by default on wide screens; stay closed on mobile until toggled.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setOpen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
      if ((e.key === "b" || e.key === "B") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Hide sidebar" : "Show sidebar"}
        aria-expanded={open}
        className="absolute left-3 top-3 z-30 rounded-lg border border-rule bg-panel/90 px-2.5 py-1.5 text-sm backdrop-blur hover:border-accent"
      >
        {open ? "‹" : "☰"}
      </button>

      {/* Backdrop on mobile when open */}
      {open && (
        <div
          className="absolute inset-0 z-10 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`absolute inset-y-0 left-0 z-20 flex w-72 max-w-[80vw] flex-col overflow-y-auto border-r border-rule bg-panel/85 backdrop-blur transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="px-5 pb-6 pt-14">
          <Link href="/" className="block">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
              Impartial · AI · Grounded
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">World News Globe</h1>
          </Link>

          <Link
            href="/world"
            className="mt-4 block rounded-lg border border-rule bg-panel px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            🌍 Top news around the world
          </Link>

          <Link
            href="/feed"
            className="mt-2 block rounded-lg border border-rule bg-panel px-3 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            ★ My feed
          </Link>

          {/* Topics */}
          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Topics</p>
            <nav className="flex flex-col gap-1" aria-label="News topics">
              {topics.map((t) => (
                <Link
                  key={t.slug}
                  href={`/topic/${t.slug}`}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    t.slug === activeSlug
                      ? "bg-accent/15 text-accent"
                      : "text-foreground/90 hover:bg-panel-soft"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                    style={{ backgroundColor: dotColor(t.topic) }}
                  />
                  <span aria-hidden>{t.emoji}</span>
                  {t.topic}
                </Link>
              ))}
            </nav>
          </div>

          {/* Favourites */}
          <div className="mt-6">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">★ Favourites</p>
            {favourites.countries.length === 0 && favourites.topics.length === 0 ? (
              <p className="text-xs text-muted">
                Star a country or topic to pin it here.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {favourites.countries.map((c) => (
                  <Link
                    key={`c-${c.id}`}
                    href={`/country/${c.id}`}
                    className="rounded-md px-2.5 py-1.5 text-sm text-review transition-colors hover:bg-panel-soft"
                  >
                    ★ {c.label}
                  </Link>
                ))}
                {favourites.topics.map((t) => (
                  <Link
                    key={`t-${t.id}`}
                    href={`/topic/${t.id}`}
                    className="rounded-md px-2.5 py-1.5 text-sm text-accent transition-colors hover:bg-panel-soft"
                  >
                    ★ {t.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <p className="mt-8 text-[10px] text-muted">
            Tip: Ctrl/⌘+B toggles this panel · Esc closes
          </p>
        </div>
      </aside>
    </>
  );
}
