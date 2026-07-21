"use client";

import { useEffect, useState } from "react";
import EpisodeForm from "@/components/EpisodeForm";

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("podcastRepurposerTheme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored ?? (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    setMounted(true);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("podcastRepurposerTheme", next);
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black sm:px-6 sm:py-16">
      <main className="flex w-full max-w-3xl flex-col items-start gap-8">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Podcast Repurposer</h1>
            <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
              Paste an episode transcript and get a blog post, show notes, social
              snippets, and chapter markers generated in one pass.
            </p>
          </div>
          {mounted && (
            <button
              type="button"
              onClick={toggleTheme}
              className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
          )}
        </div>
        <EpisodeForm />
      </main>
    </div>
  );
}
