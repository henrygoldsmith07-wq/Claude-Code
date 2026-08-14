"use client";
import { provenanceForStory, timelineConfidence, disputedFacts, splitStoryContent } from "@/lib/provenance";
import type { StoryCluster } from "@/lib/storyModel";

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./,""); } catch { return url; }
}

export default function ClaimProvenance({ story }: { story: StoryCluster }) {
  const claims = provenanceForStory(story);
  const tl = timelineConfidence(story);
  const disputed = disputedFacts(story);
  const split = splitStoryContent(story);
  return (
    <div className="space-y-3 rounded-xl border border-rule bg-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Provenance — claim by claim</p>
      {claims.length === 0 ? <p className="text-sm text-muted">No key claims to map.</p> : (
        <ul className="space-y-2">
          {claims.slice(0,6).map((c,i)=> (
            <li key={i} className="flex gap-2 text-sm">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${c.confidence==="high"?"bg-success": c.confidence==="medium"?"bg-accent":"bg-amber-400"}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="text-foreground">{c.text}</span>
                <span className="ml-1.5 text-xs text-muted">· {c.kind}{c.disputed?" · disputed":""}</span>
                <span className="ml-2 text-xs text-accent">
                  {c.sourceUrls.slice(0,2).map(u=> (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="mr-1.5 underline-offset-2 hover:underline">{domainOf(u)}</a>
                  ))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-lg border border-rule bg-panel-soft p-3">
        <p className="text-xs font-medium text-muted">Timeline confidence: <span className={tl.label==="high"?"text-success": tl.label==="medium"?"text-accent":"text-amber-400"}>{tl.label} ({tl.score})</span> — {tl.reasons.join(" · ")}</p>
      </div>
      {disputed.length>0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Disputed facts</p>
          <ul className="mt-2 space-y-2 text-sm">
            {disputed.map((d,i)=> (
              <li key={i} className="rounded border border-rule bg-panel p-2">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-300/80">Accounts differ on {d.dimension}</p>
                {/* Both sides get identical structure — presenting one as the
                    story and the other as a footnote is the failure mode. */}
                {d.sides.map((side, k) => (
                  <p key={k} className={k === 0 ? "mt-1.5" : "mt-1"}>
                    {side.claim}{" "}
                    <span className="text-xs text-muted">
                      ({side.attributedTo.join(", ") || "unattributed"} · {side.corroboration.independent} independent)
                    </span>
                  </p>
                ))}
                <p className="mt-1 text-xs text-amber-300/80">{d.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(split.facts.length>0||split.claims.length>0||split.analysis.length>0||split.predictions.length>0) && (
        <div className="grid gap-2 sm:grid-cols-2 text-xs lg:grid-cols-4">
          {split.facts.length>0 && <div className="rounded border border-success/30 bg-success/5 p-2"><p className="font-semibold text-success">Confirmed</p><ul className="mt-1 list-disc pl-4 text-muted">{split.facts.slice(0,3).map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
          {split.claims.length>0 && <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2"><p className="font-semibold text-amber-300">Attributed / unverified</p><ul className="mt-1 list-disc pl-4 text-muted">{split.claims.slice(0,3).map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
          {split.analysis.length>0 && <div className="rounded border border-rule bg-panel-soft p-2"><p className="font-semibold text-muted">Interpretation</p><ul className="mt-1 list-disc pl-4 text-muted">{split.analysis.slice(0,3).map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
          {split.predictions.length>0 && <div className="rounded border border-rule bg-panel-soft p-2"><p className="font-semibold text-muted">Forward-looking</p><ul className="mt-1 list-disc pl-4 text-muted">{split.predictions.slice(0,3).map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
        </div>
      )}
    </div>
  );
}
