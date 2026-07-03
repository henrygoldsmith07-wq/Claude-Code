"use client";

import { useState } from "react";
import { useFinance } from "@/lib/domains/finance";
import { useHabits } from "@/lib/domains/habits";
import { useRoutines } from "@/lib/domains/routines";
import { useHealth } from "@/lib/domains/health";
import { useSleep } from "@/lib/domains/sleep";
import { useHormesis } from "@/lib/domains/hormesis";
import { useGoals } from "@/lib/domains/goals";
import { useMeditation } from "@/lib/domains/meditation";
import { useStudy } from "@/lib/domains/study";
import { useRelationships } from "@/lib/domains/relationships";
import { useSelfImprovement } from "@/lib/domains/selfImprovement";
import { useMentalHealth } from "@/lib/domains/mentalHealth";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { buildCoachSummary } from "@/lib/coachSummary";
import { buttonClass, inputClass } from "@/components/shared/formClasses";
import type { CoachBriefing } from "@/lib/types";

export default function CoachPanel() {
  const finance = useFinance();
  const habits = useHabits();
  const routines = useRoutines();
  const health = useHealth();
  const sleep = useSleep();
  const hormesis = useHormesis();
  const goals = useGoals();
  const meditation = useMeditation();
  const study = useStudy();
  const relationships = useRelationships();
  const selfImprovement = useSelfImprovement();
  const mentalHealth = useMentalHealth();

  const [briefing, setBriefing] = useLocalStorage<CoachBriefing | null>("coach.lastBriefing", null);
  const [apiKey, setApiKey] = useLocalStorage<string>("coach.apiKey", "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const summary = buildCoachSummary({
        finance,
        habits,
        routines,
        health,
        sleep,
        hormesis,
        goals,
        meditation,
        study,
        relationships,
        selfImprovement,
        mentalHealth,
      });
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, apiKey: apiKey || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate briefing");
      setBriefing({ ...json.briefing, generatedAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate briefing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Your AI coach reads across every domain — finance, habits, sleep, mood, and more — to surface what
        matters most today.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={generate} disabled={loading} className={buttonClass}>
          {loading ? "Thinking..." : briefing ? "Refresh briefing" : "Generate briefing"}
        </button>
        {briefing && (
          <span className="text-xs text-zinc-500">
            Last generated {new Date(briefing.generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm dark:border-rose-800 dark:bg-rose-950">
          <p>{error}</p>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Paste your own Anthropic API key (stored only in your browser):
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className={inputClass}
            />
          </label>
        </div>
      )}

      {briefing ? (
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-teal-300 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
              Today&apos;s focus
            </div>
            <p className="mt-1 text-lg font-medium">{briefing.dailyFocus}</p>
          </section>

          {briefing.wins.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Wins</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {briefing.wins.map((w, i) => (
                  <li key={i}>· {w}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Insights</h2>
            <ul className="flex flex-col gap-3">
              {briefing.insights.map((insight, i) => (
                <li key={i} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {insight.domain}
                  </div>
                  <p className="mt-1">{insight.observation}</p>
                  <p className="mt-1 font-medium text-teal-700 dark:text-teal-400">→ {insight.action}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-zinc-200 p-4 text-sm italic dark:border-zinc-800">
            {briefing.motivation}
          </section>
        </div>
      ) : (
        !error && (
          <p className="text-sm text-zinc-500">
            No briefing yet — log some data across your domains, then generate your first one.
          </p>
        )
      )}

      <details className="text-xs text-zinc-500">
        <summary className="cursor-pointer">Advanced: use your own API key</summary>
        <label className="mt-2 flex flex-col gap-1">
          Anthropic API key (stored only in your browser, sent directly to this app&apos;s API route):
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className={inputClass}
          />
        </label>
      </details>
    </div>
  );
}
