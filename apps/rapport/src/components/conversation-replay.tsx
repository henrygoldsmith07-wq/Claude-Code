"use client";

import { Badge, Card } from "@/components/ui";
import { behaviourLabel } from "@/domain/behaviours";
import { replayFor } from "@/domain/evaluation";
import type { SimulationEvaluation } from "@/domain/types";

/**
 * A turn-level replay that keeps the transcript next to the measured claim.
 * It is intentionally a set of possible strategies, never a "perfect answer"
 * generator.
 */
export function ConversationReplay({ evaluation }: { evaluation: SimulationEvaluation }) {
  const evidence = replayFor(evaluation);
  const grouped = new Map<string, typeof evidence>();
  for (const item of evidence) {
    const current = grouped.get(item.turnId) ?? [];
    current.push(item);
    grouped.set(item.turnId, current);
  }
  const turns = [...grouped.values()].sort((a, b) => (a[0]?.turnIndex ?? 0) - (b[0]?.turnIndex ?? 0));

  return (
    <Card as="section" className="mt-4">
      <Badge tone="accent">Replay</Badge>
      <h3 className="mt-3 text-base font-semibold">What the transcript shows</h3>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Each excerpt stays attached to the behaviour it supports or the opportunity it leaves open. The strategy is a
        direction to try, not a line you were supposed to say.
      </p>

      {turns.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          There was not enough transcript evidence to build a turn-by-turn replay.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {turns.map((items) => {
            const first = items[0];
            if (!first) return null;
            return (
              <li key={first.turnId} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                    {first.speaker === "user" ? "You" : "Other person"} · turn {first.turnIndex + 1}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set(items.map((item) => item.role))].map((role) => (
                      <Badge key={role} tone={role === "support" ? "accent" : "warn"}>
                        {role === "support" ? "Supported" : "Missed opportunity"}
                      </Badge>
                    ))}
                  </div>
                </div>
                <blockquote className="mt-2 border-l-2 pl-3 text-[15px] leading-relaxed" style={{ borderColor: "var(--accent)" }}>
                  “{first.quote}”
                </blockquote>
                <ul className="mt-3 space-y-2">
                  {items.map((item) => (
                    <li key={`${item.behaviour}:${item.role}`} className="text-sm leading-relaxed">
                      <span className="font-medium">{behaviourLabel(item.behaviour)}:</span> {item.observation}
                      {item.role === "missed-opportunity" ? (
                        <span className="mt-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                          Possible strategy: {item.possibleStrategy}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

