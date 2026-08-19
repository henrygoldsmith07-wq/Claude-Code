"use client";

import type { Correction } from "@/lib/corrections";
import type { Entry } from "@/lib/types";
import InsightsView from "./InsightsView";
import LongitudinalPanel from "./LongitudinalPanel";

interface Props {
  entries: Entry[];
  corrections: Correction[];
  onSelect: (id: string) => void;
  onDismissPattern: (correction: Correction) => void;
}

export default function PatternsView({ entries, corrections, onSelect, onDismissPattern }: Props) {
  return (
    <div className="mx-auto max-w-5xl p-5 sm:p-8 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Evidence over time</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Patterns</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">Signals from your reflections, with the evidence and outcomes that support or challenge them.</p>
      </div>
      <div className="mt-8">
        <InsightsView entries={entries} embedded corrections={corrections} onDismissPattern={(key, label) => onDismissPattern({ key, kind: "pattern", rejectedAt: new Date().toISOString(), reason: `User asked to stop showing ${label}.` })} />
      </div>
      <div className="mt-10 border-t border-border pt-8">
        <LongitudinalPanel entries={entries} onSelect={onSelect} corrections={corrections} onDismissPattern={onDismissPattern} embedded />
      </div>
    </div>
  );
}
