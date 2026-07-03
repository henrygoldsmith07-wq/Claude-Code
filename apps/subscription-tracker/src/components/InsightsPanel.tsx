"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import type { Subscription } from "@/lib/types";

interface Suggestion {
  subscriptionName: string;
  reason: string;
}

export default function InsightsPanel({ subscriptions }: { subscriptions: Subscription[] }) {
  const [apiKey, setApiKey] = useLocalStorage<string>("anthropicApiKey", "");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptions, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">
          Your Anthropic API key (optional — stored only in this browser)
        </label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          type="password"
          placeholder="sk-ant-..."
          autoComplete="off"
          className="w-64 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || subscriptions.filter((s) => s.active).length === 0}
        className="self-start rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {loading ? "Analyzing..." : "Get AI cancellation suggestions"}
      </button>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className="text-sm text-zinc-500">Nothing stood out — your subscriptions look reasonable.</p>
      )}

      {suggestions && suggestions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950"
            >
              <span className="font-medium">{s.subscriptionName}</span> — {s.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
