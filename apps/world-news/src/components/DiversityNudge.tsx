"use client";
import { explicitDiversityNote } from "@/lib/personalisation";
import type { SourceAttribution } from "@/lib/storyModel";
import { assessDiversity, localSourcingSuggestions } from "@/lib/sourcing";

/**
 * Source diversity for one story.
 *
 * Reports independent *owners*, not source rows: five links that trace to one
 * ownership group is one account, and saying so is the only version of this
 * panel worth showing. Gaps name the missing outlet where the registry has one.
 */
export default function DiversityNudge({
  sources,
  countryCode,
}: {
  sources: SourceAttribution[];
  countryCode?: string;
}) {
  const report = assessDiversity(sources, countryCode);
  const local = countryCode ? localSourcingSuggestions(countryCode) : null;
  const thin = report.independentGroups <= 1;

  return (
    <div className={`rounded-xl border border-dashed p-4 ${thin ? "border-amber-500/40 bg-amber-500/5" : "border-rule bg-panel/50"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Source independence</p>
      <p className="mt-2 text-sm">{report.note}</p>
      <p className="mt-1 text-xs text-muted">
        {report.independentGroups} independent owner{report.independentGroups === 1 ? "" : "s"} ·{" "}
        {report.totalSources} source{report.totalSources === 1 ? "" : "s"} · non-English{" "}
        {Math.round(report.nonEnglishShare * 100)}%
        {countryCode ? ` · local to ${countryCode.toUpperCase()} ${Math.round(report.localShare * 100)}%` : ""}
        {report.stateAffiliatedShare > 0 ? ` · state-affiliated ${Math.round(report.stateAffiliatedShare * 100)}%` : ""}
      </p>
      {report.gaps.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
          {report.gaps.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      )}
      {local && local.outlets.length > 0 && (
        <p className="mt-2 text-xs text-accent">
          Outlets based there: {local.outlets.map((o) => o.name).join(", ")}
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted">{explicitDiversityNote(report)}</p>
    </div>
  );
}
