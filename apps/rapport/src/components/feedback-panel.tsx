"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Evidence, Hedged, Meter, SourceNote } from "@/components/ui";
import type { SimulationEvaluation } from "@/domain/types";

// ---------------------------------------------------------------------------
// Post-conversation feedback.
//
// Order is deliberate: what worked, then exactly one thing to improve, then the
// principle, then an exercise. The scores are shown last and collapsed, because
// they are the least useful part — a user who reads "0.62 on reciprocity" has
// learned nothing they can act on.
//
// The model, where available, rewrites the wording. Its input is the evidence
// computed on-device, and it cannot change which behaviour was selected or what
// the numbers are.
// ---------------------------------------------------------------------------

export function FeedbackPanel({ evaluation, skillName }: { evaluation: SimulationEvaluation; skillName: string }) {
  const [phrasing, setPhrasing] = useState<{
    whatWorked: string[];
    observation: string;
    principle: string;
    exampleAlternative: string;
  } | null>(null);
  const [source, setSource] = useState<"ai" | "fallback">("fallback");
  const [note, setNote] = useState<string | undefined>();
  const [showScores, setShowScores] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            request: {
              task: "phrase-feedback",
              scores: evaluation.scores.map((score) => ({
                key: score.key,
                score: score.score,
                evidence: score.evidence,
              })),
              improvement: evaluation.highestImpactImprovement,
              whatWorked: evaluation.whatWorked,
              excerpts: [],
              skillName,
            },
          }),
        });
        const payload = (await response.json()) as {
          data?: typeof phrasing;
          source?: "ai" | "fallback";
          note?: string;
        };
        if (cancelled || !payload.data) return;
        setPhrasing(payload.data);
        setSource(payload.source ?? "fallback");
        setNote(payload.note);
      } catch {
        if (!cancelled) setNote("Offline — showing the measured feedback.");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [evaluation, skillName]);

  const worked = phrasing?.whatWorked ?? evaluation.whatWorked;
  const improvement = evaluation.highestImpactImprovement;
  const reliable = evaluation.scores.filter((score) => score.reliable);

  return (
    <Card as="section" className="rise">
      <Badge tone="accent">Feedback</Badge>

      <section className="mt-4">
        <h3 className="text-base font-semibold">What worked</h3>
        {worked.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {worked.map((item) => (
              <li key={item} className="text-[15px] leading-relaxed">{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            The conversation was too short to pick out specifics — that is not a criticism, just a limit on what
            can be measured.
          </p>
        )}
      </section>

      <section className="mt-5 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-base font-semibold">The one thing worth changing</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {phrasing?.observation ?? improvement.observation}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed">{phrasing?.principle ?? improvement.principle}</p>
        <Hedged label="One way it could go">
          {phrasing?.exampleAlternative ?? improvement.exampleAlternative}
          <span className="mt-1.5 block text-xs" style={{ color: "var(--text-faint)" }}>
            An illustration, not the right answer. There isn&apos;t one.
          </span>
        </Hedged>
      </section>

      <section className="mt-5 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-base font-semibold">Next exercise</h3>
        <p className="mt-2 text-[15px] leading-relaxed">{evaluation.nextExercise.prompt}</p>
        <Evidence items={evaluation.nextExercise.criteria} />
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/">
          <Button>Back to today</Button>
        </Link>
        <Button variant="secondary" onClick={() => setShowScores((value) => !value)} aria-expanded={showScores}>
          {showScores ? "Hide" : "Show"} the measurements
        </Button>
      </div>

      {showScores ? (
        <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Counted from the transcript on your device. Behaviours with too little material to judge are marked
            and excluded from your skill estimates.
          </p>
          {evaluation.scores.map((score) => (
            <div key={score.key}>
              <Meter
                value={score.score}
                label={label(score.key)}
                sublabel={score.reliable ? undefined : "not enough to judge"}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>{score.evidence}</p>
            </div>
          ))}
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            {reliable.length} of {evaluation.scores.length} behaviours had enough material to score.
          </p>
        </div>
      ) : null}

      <SourceNote source={source} note={note} />
    </Card>
  );
}

function label(key: string): string {
  const labels: Record<string, string> = {
    relevance: "Staying with what they said",
    listening: "Showing you listened",
    followUpQuality: "Follow-up questions",
    reciprocity: "Give and take",
    clarity: "Clarity",
    assertiveness: "Stating your position",
    empathy: "Acknowledging how they felt",
    topicTransitions: "Topic changes",
    questionQuality: "Question quality",
    contribution: "Share of the conversation",
  };
  return labels[key] ?? key;
}
