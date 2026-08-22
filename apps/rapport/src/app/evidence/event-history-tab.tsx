"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Hedged } from "@/components/ui";
import type { DomainEvent } from "@/domain/events";
import { buildRapportPulseHistory, readRapportPulseOptIn } from "@/data/pulse-history";
import { Metric } from "./shared";

export function EventHistoryTab({ events, pulseHistory }: { events: DomainEvent[]; pulseHistory: ReturnType<typeof buildRapportPulseHistory> }) {
  const [pulseOptIn, setPulseOptIn] = useState(false);
  useEffect(() => {
    // Shared storage is optional; the event log remains in IndexedDB either way.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPulseOptIn(readRapportPulseOptIn());
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-base font-semibold">Persistent Rapport Event History</h2><p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>Every human review and real-world outcome is appended beside the existing practice events. The log is the audit trail; derived reports can be rebuilt from it.</p></div>
          <Badge tone="accent">{events.length} events</Badge>
        </div>
        <div className="mt-4 space-y-2">
          {events.length === 0 ? <EmptyState title="No events yet" body="Events appear after practice, a human label, an adjudication or a real-world outcome." /> : [...events].reverse().slice(0, 40).map((event, index) => <div key={`${event.at}:${index}`} className="flex items-start justify-between gap-3 rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}><div><p className="text-sm font-medium">{eventLabel(event)}</p><p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{event.at}</p></div><Badge>{event.kind}</Badge></div>)}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Pulse-Compatible Event Log</h2><p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>A transcript-free sidecar uses the existing Pulse source-history envelope. It contains aggregate events only; Pulse sharing still requires its separate opt-in.</p></div><Badge tone={pulseOptIn ? "accent" : "neutral"}>{pulseOptIn ? "Pulse sharing on" : "Pulse sharing off"}</Badge></div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><Metric label="Practice records" value={pulseHistory.records.length} /><Metric label="Safe event records" value={pulseHistory.eventLog.length} /><Metric label="Human review events" value={pulseHistory.eventLog.filter((event) => event.kind === "human-rating" || event.kind === "human-adjudication").length} /><Metric label="Transfer outcomes" value={pulseHistory.eventLog.filter((event) => event.kind === "real-world-outcome").length} /></div>
        <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => downloadJson("rapport-pulse-event-log.json", pulseHistory)}>Download safe event log</Button><Hedged label="Privacy boundary">Exact behaviour evidence stays in the local Rapport evidence workspace. The Pulse-compatible log contains counts, scores and event labels only.</Hedged></div>
      </Card>
    </div>
  );
}

function eventLabel(event: DomainEvent): string {
  switch (event.kind) {
    case "simulation-evaluated": return `Simulation evaluated · ${event.skillIds.join(", ") || "no skill"}`;
    case "challenge-attempted": return `Challenge attempted · ${event.outcome}`;
    case "challenge-skipped": return "Challenge skipped";
    case "exercise-completed": return "Exercise completed";
    case "lesson-read": return "Lesson read";
    case "reflection-recorded": return "Reflection recorded";
    case "assessment-completed": return "Assessment completed";
    case "user-corrected-skill": return "User corrected a skill estimate";
    case "session-completed": return "Session completed";
    case "human-rating-recorded": return `Human rating recorded · ${event.behaviourKeys.join(", ")}`;
    case "human-adjudication-completed": return `Adjudication completed · ${event.behaviourKey}`;
    case "real-world-outcome-recorded": return `Real-world outcome recorded · ${event.outcome}`;
  }
}

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
