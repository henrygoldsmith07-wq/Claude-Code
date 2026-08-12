"use client";

import Link from "next/link";
import { useState } from "react";
import { contextLine, route } from "@/domain/coach";
import type { CoachRouting } from "@/domain/coach";
import { getSkill } from "@/domain/skills";
import { Badge, Button, Card, Hedged, PageHeader, SourceNote, TextArea } from "@/components/ui";
import { useStore } from "@/state/store";

// ---------------------------------------------------------------------------
// The coach.
//
// It does not answer "what should I say". Every question is routed to the
// underlying skill, the principle is explained, and practice is offered — which
// is the difference between a training system and a tool people end up needing
// in order to have conversations.
//
// The routing is deterministic (src/domain/coach.ts). A model, where available,
// rewrites the explanation in the user's terms; it cannot change the routing or
// turn the answer into a script.
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "My conversations keep dying after a couple of exchanges.",
  "I never speak up in meetings.",
  "I can't say no without over-explaining.",
  "I don't know what to say when someone's upset.",
  "I want to make friends at work but it stays at small talk.",
];

export default function CoachPage() {
  const store = useStore();
  const [question, setQuestion] = useState("");
  const [routing, setRouting] = useState<CoachRouting | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{ explanation: string; example: string } | null>(null);
  const [source, setSource] = useState<"ai" | "fallback">("fallback");
  const [note, setNote] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const ask = async (text: string) => {
    setBusy(true);
    setRefusal(null);
    setExplanation(null);
    const result = route(text, store.states);
    if (result.kind === "refused") {
      setRefusal(result.message);
      setRouting(null);
      setBusy(false);
      return;
    }
    setRouting(result.routing);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request: {
            task: "coach-explain",
            question: text,
            skillName: getSkill(result.routing.skillId)?.name ?? "this skill",
            diagnosis: result.routing.diagnosis,
            technique: result.routing.technique,
            context: contextLine(result.routing.skillId, store.states),
          },
        }),
      });
      const payload = (await response.json()) as {
        data?: { explanation: string; example: string };
        source?: "ai" | "fallback";
        note?: string;
        refused?: boolean;
        message?: string;
      };
      if (payload.refused) {
        setRefusal(payload.message ?? "I can't help with that one.");
        setRouting(null);
      } else if (payload.data) {
        setExplanation(payload.data);
        setSource(payload.source ?? "fallback");
        setNote(payload.note);
      }
    } catch {
      setNote("Offline — showing the built-in explanation.");
    }
    setBusy(false);
  };

  const skill = routing ? getSkill(routing.skillId) : null;

  return (
    <>
      <PageHeader
        title="Coach"
        subtitle="Describe what is going wrong. You will get the skill underneath it and the principle — not a line to memorise."
      />

      <Card>
        <label htmlFor="question" className="text-sm font-medium">What is happening?</label>
        <div className="mt-2">
          <TextArea
            id="question"
            rows={3}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="e.g. Conversations with new people dry up after a minute."
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void ask(question)} disabled={busy || question.trim().length < 6}>
            {busy ? "Thinking…" : "Ask"}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              onClick={() => {
                setQuestion(item);
                void ask(item);
              }}
              className="rounded-full border px-3 py-1.5 text-xs"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      {refusal ? (
        <Card className="mt-4">
          <p className="text-[15px] leading-relaxed">{refusal}</p>
        </Card>
      ) : null}

      {routing && skill ? (
        <Card className="mt-4 rise">
          <Badge tone="accent">Underlying skill: {skill.name}</Badge>

          <section className="mt-4">
            <h2 className="text-sm font-semibold">What is probably going on</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed">{routing.diagnosis}</p>
          </section>

          <section className="mt-4">
            <h2 className="text-sm font-semibold">The technique</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed">{routing.technique}</p>
          </section>

          {explanation?.explanation ? (
            <section className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-sm font-semibold">In your situation</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed">{explanation.explanation}</p>
              {explanation.example ? (
                <Hedged label="One illustration">{explanation.example}</Hedged>
              ) : null}
            </section>
          ) : null}

          {routing.foundation ? (
            <Hedged label="Worth knowing">
              This builds on {getSkill(routing.foundation.skillId)?.name ?? routing.foundation.skillId}, which does not
              look settled yet. {routing.foundation.rationale}{" "}
              <Link href={`/skills/${encodeURIComponent(routing.foundation.skillId)}`} className="underline">
                Look at that first
              </Link>
              .
            </Hedged>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {routing.practiceScenario ? (
              <Link href={`/practise/${encodeURIComponent(routing.practiceScenario.id)}`}>
                <Button>Practise this now</Button>
              </Link>
            ) : null}
            <Link href={`/skills/${encodeURIComponent(routing.skillId)}`}>
              <Button variant="secondary">Open the skill</Button>
            </Link>
            <Button variant="ghost" onClick={() => void store.assignChallenge(routing.skillId)}>
              Give me a real-world version
            </Button>
          </div>

          <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
            {contextLine(routing.skillId, store.states)}
          </p>
          <SourceNote source={source} note={note} />
        </Card>
      ) : null}
    </>
  );
}
