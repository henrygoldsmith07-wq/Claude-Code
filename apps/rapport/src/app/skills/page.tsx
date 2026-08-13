"use client";

import Link from "next/link";
import { useState } from "react";
import { ALL_DOMAINS, DOMAIN_LABELS, skillsInDomain } from "@/domain/skills";
import { stateFor, stateIsConfident } from "@/domain/mastery";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui";
import { useStore } from "@/state/store";
import type { SkillDomain } from "@/domain/types";

// ---------------------------------------------------------------------------
// The skill graph, by domain.
//
// The state band is shown only where there is enough evidence to assert one.
// Below that threshold it says "estimating" rather than picking a label — a
// user reading "Developing" about a skill the app has never seen them use would
// be reading a guess dressed as a measurement.
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const store = useStore();
  const [open, setOpen] = useState<SkillDomain | null>("conversation");

  if (!store.ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const byId = new Map(store.states.map((state) => [state.skillId, state]));

  return (
    <>
      <PageHeader
        title="Skills"
        subtitle="Ten domains of communication behaviour. Skills that build on others say so, and you can correct any estimate."
      />

      <div className="space-y-3">
        {ALL_DOMAINS.map((domain) => {
          const skills = skillsInDomain(domain);
          const practised = skills.filter((skill) => (byId.get(skill.id)?.attemptCount ?? 0) > 0).length;
          const expanded = open === domain;
          return (
            <Card key={domain} as="section">
              <button
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setOpen(expanded ? null : domain)}
                aria-expanded={expanded}
              >
                <span className="text-base font-semibold">{DOMAIN_LABELS[domain]}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={practised > 0 ? "accent" : "neutral"}>
                    {practised}/{skills.length} practised
                  </Badge>
                </span>
              </button>

              {expanded ? (
                <ul className="mt-4 space-y-2">
                  {skills.map((skill) => {
                    const state = byId.get(skill.id);
                    const started = (state?.attemptCount ?? 0) > 0;
                    return (
                      <li key={skill.id}>
                        <Link
                          href={`/skills/${encodeURIComponent(skill.id)}`}
                          className="flex items-start justify-between gap-3 rounded-[10px] border px-3 py-2.5 transition-colors"
                          style={{ borderColor: "var(--border)", background: "var(--bg)" }}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{skill.name}</span>
                            <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
                              {skill.summary}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs" style={{ color: "var(--text-faint)" }}>
                            {!started
                              ? "not started"
                              : state && stateIsConfident(state)
                                ? stateFor(state.mastery)
                                : "estimating"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
