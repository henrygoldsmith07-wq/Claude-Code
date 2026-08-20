"use client";

import { behaviourLabel } from "@/domain/behaviours";
import { evidenceSourceLabel } from "@/domain/evidence";
import type { BehaviourEvidenceProfile, EvidenceSource } from "@/domain/evidence";
import { getSkill } from "@/domain/skills";
import { Badge, Card, EmptyState } from "@/components/ui";

const SOURCES: EvidenceSource[] = ["simulator", "self-reported-mission", "human-rated", "validated-transfer"];

export function EvidenceLedger({ profiles, title = "Evidence by behaviour", compact = false }: { profiles: BehaviourEvidenceProfile[]; title?: string; compact?: boolean }) {
  const observed = profiles
    .filter((profile) => profile.amountOfEvidence > 0 || profile.sources["validated-transfer"].count > 0)
    .sort((a, b) => b.amountOfEvidence - a.amountOfEvidence || (a.recentPerformance ?? -1) - (b.recentPerformance ?? -1));

  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        These channels stay separate: a simulator score, a mission reflection and a human rating answer different
        questions. The confidence shown here is confidence in the sample, not a personality judgement.
      </p>
      {observed.length === 0 ? (
        <div className="mt-4"><EmptyState title="No behaviour evidence yet" body="A measurable practice turn or a real-world mission will appear here without inventing a score beforehand." /></div>
      ) : (
        <div className="mt-4 space-y-3">
          {observed.slice(0, compact ? 6 : undefined).map((profile) => (
            <div key={profile.behaviour} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{behaviourLabel(profile.behaviour)}</h3>
                  {profile.skillId && getSkill(profile.skillId) ? <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{getSkill(profile.skillId)?.name}</p> : null}
                </div>
                <Badge tone={profile.recentPerformance !== null && profile.recentPerformance < 0.55 ? "warn" : "neutral"}>
                  {profile.recentPerformance === null ? "No recent score" : `Recent ${Math.round(profile.recentPerformance * 100)}%`}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                {SOURCES.map((source) => (
                  <div key={source}>
                    <p style={{ color: "var(--text-faint)" }}>{evidenceSourceLabel(source)}</p>
                    <p className="mt-0.5 font-semibold">{profile.sources[source].count || "—"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>{profile.scenarioDiversity || "No"} simulator situations</span>
                <span>{profile.assistance ? `${profile.assistance} assistance` : "No simulator assistance record"}</span>
                <span>{Math.round(profile.confidence * 100)}% sample confidence</span>
                {profile.retention !== null ? <span>{Math.round(profile.retention * 100)}% estimated retention</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
        A validated-transfer count appears only when a real-world item has an adjudicated or agreement-supported human
        rating. A self-report alone remains a self-report.
      </p>
    </Card>
  );
}

