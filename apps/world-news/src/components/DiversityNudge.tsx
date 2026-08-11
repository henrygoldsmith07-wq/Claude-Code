"use client";
import { explicitDiversityNote } from "@/lib/personalisation";
import type { SourceMix } from "@/lib/storyModel";
import { diversityReport, localSourcingNote } from "@/lib/sourcing";

export default function DiversityNudge({ mix, countryCode }: { mix: SourceMix; countryCode?: string }) {
  const note = explicitDiversityNote(mix);
  const rep = diversityReport(mix);
  const local = countryCode ? localSourcingNote(countryCode) : null;
  return (
    <div className="rounded-xl border border-dashed border-rule bg-panel/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Viewpoint &amp; source diversity</p>
      <p className="mt-2 text-sm text-muted">{note}</p>
      <p className="mt-1 text-xs text-muted">Entropy {rep.entropy} · non-English share {Math.round(rep.nonEnglishShare*100)}% — {rep.note}</p>
      {local && <p className="mt-2 text-xs text-accent">{local}</p>}
      <p className="mt-2 text-[11px] text-muted">Tip: star a few regions + topics in “My Feed” to keep discovery broad — the feed warns when one country or topic dominates.</p>
    </div>
  );
}
