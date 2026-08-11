"use client";

import type { Entry } from "@/lib/types";
import {
  calibrationFor,
  detectContradictions,
  detectRecurringAssumptions,
  detectRecurringPatterns,
  longitudinalSummary,
  monthlyReviews,
  predictionAccuracySeries,
  weeklyReviews,
  unresolvedEntries,
} from "@/lib/longitudinal";
import { allTopics, entryRelationships } from "@/lib/search";

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "amber" | "emerald" | "sky" }) {
  const cls =
    tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
    : tone === "amber" ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
    : tone === "sky" ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
    : "border-border bg-card text-muted";
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export default function LongitudinalPanel({
  entries,
  onSelect,
}: {
  entries: Entry[];
  onSelect: (id: string) => void;
}) {
  const completed = entries.filter((e) => e.summary);
  if (completed.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted">{longitudinalSummary(entries)}</p>
      </div>
    );
  }

  const cal = calibrationFor(entries);
  const recurring = detectRecurringAssumptions(entries);
  const patterns = detectRecurringPatterns(entries);
  const contras = detectContradictions(entries);
  const unresolved = unresolvedEntries(entries);
  const topics = allTopics(entries);
  const links = entryRelationships(entries);
  const series = predictionAccuracySeries(entries);
  const weeks = weeklyReviews(entries).slice(-6);
  const months = monthlyReviews(entries).slice(-6);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary + calibration */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Longitudinal summary</h3>
        <p className="mt-2 text-sm leading-relaxed">{longitudinalSummary(entries)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>Reviewed {cal.totalReviewed}</Badge>
          <Badge tone="emerald">unsupported {cal.unsupported}</Badge>
          <Badge tone="amber">supported {cal.supported}</Badge>
          {cal.partial > 0 && <Badge tone="sky">partial {cal.partial}</Badge>}
          {cal.unclear > 0 && <Badge>unclear {cal.unclear}</Badge>}
          {cal.accuracy !== null && <Badge>accuracy {cal.accuracy}% supported</Badge>}
        </div>
      </div>

      {/* Predicted vs actual */}
      {series.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Predicted vs actual outcomes</h3>
          <p className="mt-1 text-xs text-muted">Each reviewed reflection — did the prediction match reality?</p>
          <div className="mt-3 flex flex-col gap-2">
            {series.slice(-8).map((p, i) => (
              <div key={i} className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">{new Date(p.date).toLocaleDateString()}</span>
                  <Badge tone={p.verdict === "unsupported" ? "emerald" : p.verdict === "supported" ? "amber" : "sky"}>{p.verdict}</Badge>
                </div>
                <p className="mt-1 text-xs"><span className="font-medium">Predicted:</span> {p.predicted.slice(0, 120)}</p>
                <p className="text-xs"><span className="font-medium">Actual:</span> {p.actual.slice(0, 120) || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recurring */}
      {recurring.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Recurring assumptions (no labels — just patterns)</h3>
          <div className="mt-2 flex flex-col gap-2">
            {recurring.slice(0, 4).map((g, i) => (
              <div key={i} className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-sm font-medium">“{g.representative.slice(0, 90)}” ×{g.count}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {g.members.slice(0, 4).map((m) => (
                    <button key={m.entryId} onClick={() => onSelect(m.entryId)} className="rounded-full border border-border bg-card px-2 py-0.5 text-xs hover:bg-card-hover">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {patterns.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Recurring patterns (descriptive, not diagnostic)</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {patterns.slice(0, 8).map((p, i) => (
              <span key={i} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                <span className="text-muted">{p.kind}:</span> {p.label} <span className="text-muted">×{p.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {contras.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-dangersoft p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-danger">Possible contradictions across entries</h3>
          <p className="mt-1 text-xs text-muted">Same theme, different conclusions — worth re-examining with evidence for vs against.</p>
          <div className="mt-2 flex flex-col gap-2">
            {contras.slice(0, 4).map((c, i) => (
              <div key={i} className="rounded-lg border border-danger/20 bg-card px-3 py-2 text-sm">
                <p className="text-xs text-muted">{c.reason}</p>
                <p className="mt-1 text-sm">“{c.assumptions[0].slice(0, 80)}” ↔ “{c.assumptions[1].slice(0, 80)}”</p>
                <div className="mt-1 flex gap-1">
                  <button onClick={() => onSelect(c.entryA)} className="text-xs text-accent hover:underline">Entry A</button>
                  <span className="text-xs text-muted">·</span>
                  <button onClick={() => onSelect(c.entryB)} className="text-xs text-accent hover:underline">Entry B</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unresolved.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700">Unresolved follow-ups — due for review</h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {unresolved.slice(0, 6).map((e) => (
              <button key={e.id} onClick={() => onSelect(e.id)} className="rounded-lg border border-amber-500/20 bg-card px-3 py-2 text-left text-sm hover:bg-card-hover">
                <span className="font-medium">{e.title}</span>
                <span className="ml-2 text-xs text-muted">follow-up {e.summary?.trace.followUpAt ?? "open"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {topics.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Tags / topics</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topics.slice(0, 16).map((t) => (
              <span key={t.tag} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                {t.tag} <span className="text-muted">×{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Relationships between reflections</h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {links.slice(0, 6).map((l, i) => (
              <p key={i} className="rounded-lg border border-border bg-background px-3 py-2 text-xs">
                <button onClick={() => onSelect(l.a)} className="font-medium text-accent hover:underline">Entry</button>
                {" ↔ "}
                <button onClick={() => onSelect(l.b)} className="font-medium text-accent hover:underline">Entry</button>
                <span className="text-muted"> — {l.reason}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {(weeks.length > 0 || months.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {weeks.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Weekly review</h3>
              <div className="mt-2 flex flex-col gap-1.5">
                {weeks.map((w) => (
                  <p key={w.period} className="flex justify-between rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                    <span className="font-medium">{w.period}</span>
                    <span className="text-muted">{w.entries.length} reflections · {w.emotions.slice(0, 2).join(", ") || "—"}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
          {months.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Monthly review</h3>
              <div className="mt-2 flex flex-col gap-1.5">
                {months.map((m) => (
                  <p key={m.period} className="flex justify-between rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                    <span className="font-medium">{m.period}</span>
                    <span className="text-muted">{m.entries.length} · {m.emotions.slice(0, 2).join(", ") || "—"}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
