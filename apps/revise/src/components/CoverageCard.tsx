"use client";

import { useMemo } from "react";
import { seedCardsForTopic } from "@/content/seed-cards";
import { seedQuestions } from "@/content";
import { allSubjects, allTopics, topicsFor } from "@/domain/curriculum";
import { coverageForSubject } from "@/domain/coverage";
import { SPEC_MANIFEST } from "@/domain/spec";
import { Panel, Pill, ProgressBar, SectionHeading } from "./ui";

export function CoverageCard({ subjectId }: { subjectId?: string }) {
  const rows = useMemo(() => {
    const subjects = subjectId ? allSubjects().filter((s) => s.id === subjectId) : allSubjects();
    return subjects.map((subject) => {
      const topics = topicsFor(subject.id);
      const questions = seedQuestions.filter((q) => q.subjectId === subject.id);
      const cardsPerTopic = new Map<string, number>(
        topics.map((t) => [t.id, seedCardsForTopic(t, "coverage").length]),
      );
      const cov = coverageForSubject(topics, questions, cardsPerTopic);
      const spec = SPEC_MANIFEST.find((s) => s.subjectId === subject.id);
      return { subject, cov, spec };
    });
  }, [subjectId]);

  if (!rows.length) return null;

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Specification coverage"
        hint="Measured automatically from authored topics, retrieval cards and exam questions. This is the competitive moat."
      />
      <div className="grid gap-3">
        {rows.map(({ subject, cov, spec }) => (
          <Panel key={subject.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {subject.name}{" "}
                <span className="font-normal text-ink3">
                  · {subject.specCode ?? subject.id} · {spec?.version ?? cov.specVersion ?? "—"}
                </span>
              </p>
              <Pill tone={cov.coveragePercent >= 90 ? "success" : cov.coveragePercent >= 70 ? "review" : undefined}>
                {cov.coveragePercent}% coverage
              </Pill>
            </div>

            <div className="mt-3">
              <ProgressBar value={cov.coveragePercent / 100} tone={cov.coveragePercent >= 80 ? "success" : "accent"} />
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Topics</p>
                <p className="text-sm font-semibold tabular-nums">
                  {cov.topicsCovered}/{cov.topicsTotal}
                </p>
              </div>
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Retrieval items</p>
                <p className="text-sm font-semibold tabular-nums">{cov.retrievalItems}</p>
              </div>
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Exam questions</p>
                <p className="text-sm font-semibold tabular-nums">{cov.examQuestions}</p>
              </div>
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Last checked</p>
                <p className="text-sm font-semibold tabular-nums">{cov.lastChecked ?? spec?.lastChecked ?? "—"}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill>
                Verified {cov.byVerification.verified ?? 0}/{cov.topicsTotal}
              </Pill>
              <Pill>Checked {cov.byVerification.checked ?? 0}</Pill>
              <Pill>Unverified {cov.byVerification.unverified ?? 0}</Pill>
              {spec?.statementsTotal ? (
                <Pill tone="accent">
                  Spec statements {cov.specPointsVerified}/{spec.statementsTotal} verified
                </Pill>
              ) : null}
            </div>

            {cov.gaps.length ? (
              <p className="text-[11px] text-ink3 mt-2">
                {cov.gaps.filter((g) => g.kind === "no-spec-points").length} topics still need fine-grained spec points ·{" "}
                {cov.gaps.filter((g) => g.kind === "no-questions").length} topics with no exam question yet
              </p>
            ) : null}

            <p className="text-[11px] text-ink3 mt-2">
              {subject.name}: {spec ? `spec ${spec.specCode} v${spec.version}` : "no manifest"} · last checked{" "}
              {spec?.lastChecked ?? cov.lastChecked ?? "—"}
            </p>
          </Panel>
        ))}
      </div>

      <p className="text-[11px] text-ink3">
        Coverage is measured from authored content the app ships with. Generated and past-paper questions add to the
        in-device totals once you create them. Run{" "}
        <code className="px-1 py-0.5 rounded bg-surface2">node scripts/validate-curriculum.mjs</code> in CI to block a
        coverage regression. Full topic counts: {allTopics().length} topics across {allSubjects().length} subjects.
      </p>
    </div>
  );
}
