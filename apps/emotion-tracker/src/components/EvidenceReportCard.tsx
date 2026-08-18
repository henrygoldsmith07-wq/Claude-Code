"use client";

import { useMemo, useState } from "react";
import type { Entry } from "@/lib/types";
import {
  buildLongitudinalEvidenceReport,
  renderLongitudinalEvidenceReportMarkdown,
} from "@/lib/evidenceReport";

type ReportWindow = "all" | "30" | "90";

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function EvidenceReportCard({
  entries,
  onSelect,
}: {
  entries: Entry[];
  onSelect: (id: string) => void;
}) {
  const [window, setWindow] = useState<ReportWindow>("all");
  const report = useMemo(() => {
    const from = window === "all" ? null : dateDaysAgo(Number(window));
    return buildLongitudinalEvidenceReport(entries, { from });
  }, [entries, window]);

  function exportJson(): void {
    download(
      `reflect-longitudinal-evidence-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(report, null, 2),
      "application/json",
    );
  }

  function exportMarkdown(): void {
    download(
      `reflect-longitudinal-evidence-${new Date().toISOString().slice(0, 10)}.md`,
      renderLongitudinalEvidenceReportMarkdown(report),
      "text/markdown",
    );
  }

  return (
    <section className="rounded-xl border border-accent/20 bg-accent/5 p-4" aria-labelledby="evidence-report-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="evidence-report-title" className="text-xs font-semibold uppercase tracking-wider text-accent">Longitudinal evidence report</h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
            A dated, evidence-linked view of what changed across reflections. Conversation messages stay out of the report; each finding points back to local entries.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
            Window
            <select
              aria-label="Report window"
              value={window}
              onChange={(event) => setWindow(event.target.value as ReportWindow)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
            >
              <option value="all">All time</option>
              <option value="90">Last 90 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <button type="button" onClick={exportMarkdown} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-card-hover">Export Markdown</button>
          <button type="button" onClick={exportJson} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-card-hover">Export JSON</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Reflections</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{report.summary.completedEntries}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Reviewed</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{report.summary.reviewedEntries}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Observations</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{report.evidence.observations}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">Linked</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{report.evidence.linkedObservations}</p>
        </div>
      </div>

      {report.findings.length > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Findings with evidence</h4>
            <span className="text-[11px] text-muted">{report.findings.length} finding{report.findings.length === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {report.findings.slice(0, 4).map((finding) => (
              <div key={finding.id} className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-sm font-medium">{finding.title}</p>
                <p className="mt-0.5 text-xs text-muted">{finding.detail}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-[11px] text-muted">Evidence:</span>
                  {finding.entryIds.slice(0, 5).map((id) => (
                    <button key={id} type="button" onClick={() => onSelect(id)} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-accent hover:bg-card-hover">
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.timeline.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Evidence over time</h4>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">Reflections</th>
                  <th className="px-3 py-2 font-medium">Reviewed</th>
                  <th className="px-3 py-2 font-medium">Observations</th>
                  <th className="px-3 py-2 font-medium">Linked</th>
                </tr>
              </thead>
              <tbody>
                {report.timeline.slice(-6).map((period) => (
                  <tr key={period.period} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{period.period}</td>
                    <td className="px-3 py-2 tabular-nums">{period.completedEntries}</td>
                    <td className="px-3 py-2 tabular-nums">{period.reviewedEntries}</td>
                    <td className="px-3 py-2 tabular-nums">{period.observationCount}</td>
                    <td className="px-3 py-2 tabular-nums">{period.linkedObservations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report.summary.completedEntries === 0 && (
        <p className="mt-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted">No completed reflections in this window yet. The report will fill in as structured reflections are completed.</p>
      )}
    </section>
  );
}
