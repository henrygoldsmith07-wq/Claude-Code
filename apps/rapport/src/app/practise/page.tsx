"use client";

import Link from "next/link";
import { useState } from "react";
import { SCENARIOS } from "@/domain/scenarios";
import { buildScenario } from "@/domain/scenarios";
import { getSkill } from "@/domain/skills";
import { Badge, Button, Card, Field, PageHeader, TextArea } from "@/components/ui";
import { useStore } from "@/state/store";
import * as repo from "@/data/repository";

// ---------------------------------------------------------------------------
// Practise: the scenario library and the builder.
//
// The builder is deterministic — a description maps to skills, a template and
// evaluation criteria before any model is involved. A refused description gets
// a specific explanation and a suggested rewrite rather than a generic error,
// because the most common refusal here is someone phrasing a legitimate goal
// ("get them to agree") in terms the product will not train.
// ---------------------------------------------------------------------------

export default function PractisePage() {
  const store = useStore();
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [builtId, setBuiltId] = useState<string | null>(null);

  const build = async () => {
    setRefusal(null);
    const result = buildScenario({ description, difficulty, now: new Date().toISOString() });
    if (!result.ok) {
      setRefusal(result.message);
      return;
    }
    await repo.put("scenarios", result.scenario);
    setBuiltId(result.scenario.id);
  };

  return (
    <>
      <PageHeader
        title="Practise"
        subtitle="Rehearse a conversation before you have it. Characters keep track of what they have said and do not always make it easy."
      />

      <Card as="section">
        <h2 className="text-base font-semibold">Describe a situation</h2>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          In your own words. It becomes a scenario with characters, an objective and its own evaluation.
        </p>
        <div className="mt-3">
          <Field id="description" label="What do you want to practise?" hint="e.g. I need to contribute more during a group project.">
            <TextArea
              id="description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
        <fieldset className="mt-3">
          <legend className="text-sm font-medium">How hard should it be?</legend>
          <div className="mt-2 flex gap-2">
            {([1, 2, 3, 4, 5] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={difficulty === value ? "primary" : "secondary"}
                aria-pressed={difficulty === value}
                onClick={() => setDifficulty(value)}
                className="w-11"
              >
                {value}
              </Button>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={build} disabled={description.trim().length < 8}>Build it</Button>
          {builtId ? (
            <Link href={`/practise/${encodeURIComponent(builtId)}`}>
              <Button variant="secondary">Start</Button>
            </Link>
          ) : null}
        </div>
        {refusal ? (
          <div
            className="mt-4 rounded-[10px] border px-3 py-2.5 text-sm leading-relaxed"
            style={{ background: "var(--warn-soft)", borderColor: "var(--warn)", color: "var(--text)" }}
            role="status"
          >
            {refusal}
          </div>
        ) : null}
      </Card>

      <h2 className="mt-8 mb-3 text-base font-semibold">Ready-made scenarios</h2>
      <ul className="space-y-3">
        {SCENARIOS.map((scenario) => {
          const skill = getSkill(scenario.skillIds[0] ?? "");
          const state = store.states.find((item) => item.skillId === scenario.skillIds[0]);
          return (
            <Card as="li" key={scenario.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Difficulty {scenario.difficulty}/5</Badge>
                {skill ? <Badge tone="accent">{skill.name}</Badge> : null}
                {state && state.attemptCount > 0 ? <Badge>{state.attemptCount} practised</Badge> : null}
              </div>
              <h3 className="mt-2.5 text-base font-semibold">{scenario.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {scenario.context}
              </p>
              <p className="mt-2 text-sm">{scenario.objective}</p>
              <div className="mt-3">
                <Link href={`/practise/${encodeURIComponent(scenario.id)}`}>
                  <Button size="sm" variant="secondary">Start</Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </ul>
    </>
  );
}
