"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { atDifficulty, getScenario } from "@/domain/scenarios";
import { adaptiveScenarioDifficulty, assistancePlan } from "@/domain/training";
import { recentEvidence } from "@/domain/events";
import { Button, Card, PageHeader, Skeleton } from "@/components/ui";
import { SimulationRunner } from "@/components/simulation-runner";
import { useStore } from "@/state/store";
import * as repo from "@/data/repository";
import type { SimulationScenario } from "@/domain/types";

// ---------------------------------------------------------------------------
// A single practice conversation.
//
// Scenarios come either from the built-in library or from the user's own
// builder output in IndexedDB, so this resolves both. Difficulty is set from
// the user's current level rather than the scenario's nominal one — the same
// scenario is a different exercise for someone on their first week.
// ---------------------------------------------------------------------------

export default function ScenarioPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = use(params);
  const store = useStore();
  const [scenario, setScenario] = useState<SimulationScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [replay, setReplay] = useState<{ count: number; difficulty: number | null }>({ count: 0, difficulty: null });

  const id = decodeURIComponent(scenarioId);

  useEffect(() => {
    const load = async () => {
      try {
        const builtIn = getScenario(id);
        if (builtIn) {
          setScenario(builtIn);
          return;
        }
        setScenario((await repo.get("scenarios", id)) ?? null);
      } catch {
        // Blocked storage must not strand the page on skeletons forever.
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  if (loading || !store.ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error && !scenario) {
    return (
      <>
        <PageHeader title="Could not load this scenario" />
        <Card>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Local storage is unavailable, so saved scenarios cannot be read. Built-in scenarios are still available
            from the practise page.
          </p>
          <div className="mt-4">
            <Link href="/practise">
              <Button variant="secondary">Back to practise</Button>
            </Link>
          </div>
        </Card>
      </>
    );
  }

  if (!scenario) {
    return (
      <>
        <PageHeader title="Scenario not found" />
        <Card>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            This scenario no longer exists — it may have been cleared with your data.
          </p>
          <div className="mt-4">
            <Link href="/practise">
              <Button variant="secondary">Back to practise</Button>
            </Link>
          </div>
        </Card>
      </>
    );
  }

  const state = store.states.find((item) => item.skillId === scenario.skillIds[0]);
  const performances = recentEvidence(store.events)
    .filter((item) => scenario.skillIds.includes(item.skillId))
    .map((item) => item.performance);
  const level = state ? adaptiveScenarioDifficulty(state, performances) : scenario.difficulty;
  const difficulty = replay.difficulty ?? level;
  const scaled = atDifficulty(scenario, Math.min(5, Math.max(1, difficulty)) as 1 | 2 | 3 | 4 | 5);
  const assist = state ? assistancePlan(state, store.preference.assistLevel).level : "full";

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/practise" className="text-sm underline" style={{ color: "var(--text-muted)" }}>
          All scenarios
        </Link>
        {difficulty < 5 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setReplay((current) => ({ count: current.count + 1, difficulty: difficulty + 1 }))}
          >
            Replay one level harder
          </Button>
        ) : null}
      </div>

      {/* Keyed on the replay counter alone: the conversation must survive the
          skill-state updates that finishing it produces. */}
      <SimulationRunner
        key={`${scaled.id}.${replay.count}`}
        scenario={scaled}
        assistLevel={store.preference.assistLevel === "none" ? "none" : assist}
        difficulty={difficulty}
      />
    </>
  );
}
