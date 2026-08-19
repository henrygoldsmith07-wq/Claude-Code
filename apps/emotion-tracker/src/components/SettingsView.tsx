"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Entry } from "@/lib/types";
import ApiKeyBar from "./ApiKeyBar";
import PrivacyBar from "./PrivacyBar";
import {
  clearOutcomeStudyEvents,
  getOutcomeStudyEvents,
  isOutcomeStudyOptIn,
  outcomeStudySummary,
  setOutcomeStudyOptIn,
} from "@/lib/outcomeStudy";

function downloadStudyData(): void {
  const blob = new Blob([JSON.stringify(getOutcomeStudyEvents(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reflect-outcome-study-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function SettingsView({ entries, setEntries, apiKey, setApiKey }: { entries: Entry[]; setEntries: Dispatch<SetStateAction<Entry[]>>; apiKey: string; setApiKey: (value: string) => void }) {
  const [studyOn, setStudyOn] = useState(false);
  const [, refreshMetrics] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setStudyOn(isOutcomeStudyOptIn()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const metrics = outcomeStudySummary(getOutcomeStudyEvents());

  function toggleStudy(value: boolean): void {
    setOutcomeStudyOptIn(value);
    setStudyOn(value);
    refreshMetrics((current) => current + 1);
  }

  return (
    <div className="mx-auto max-w-3xl p-5 sm:p-8 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Control your data</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Privacy, connection and optional measurement controls.</p>
      </div>

      <div className="mt-8 flex flex-col gap-5">
        <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="connection-title">
          <h2 id="connection-title" className="text-sm font-semibold">AI connection</h2>
          <p className="mt-1 text-xs text-muted">Your key stays in this browser and is only used when you send a guided reflection step.</p>
          <div className="mt-3"><ApiKeyBar apiKey={apiKey} onChange={setApiKey} /></div>
        </section>

        <PrivacyBar entries={entries} setEntries={setEntries} />

        <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="study-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="study-title" className="text-sm font-semibold">Real user outcome study (optional)</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">If you are taking part in a study, opt in to record timestamps and counts for starts, completions, follow-ups and outcome reviews. Reflection text never enters this log and nothing is uploaded.</p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={studyOn} onChange={(event) => toggleStudy(event.target.checked)} />
              Record study events
            </label>
          </div>
          {studyOn && <>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Started", metrics.started], ["Completed", metrics.completed], ["Follow-ups", metrics.followUpsScheduled], ["Outcomes reviewed", metrics.outcomesReviewed]].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-border bg-background px-3 py-2"><p className="text-[11px] text-muted">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={downloadStudyData} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-card-hover">Export study events</button>
              <button type="button" onClick={() => { clearOutcomeStudyEvents(); refreshMetrics((current) => current + 1); }} className="rounded-lg border border-danger/30 bg-dangersoft px-3 py-1.5 text-xs font-medium text-danger hover:brightness-95">Clear study events</button>
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}
