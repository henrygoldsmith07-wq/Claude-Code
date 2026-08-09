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
        hint="Statement-level, measurable. Each specPoint is one examinable claim with its own provenance. This is the moat."
      />
      <div className="grid gap-3">
        {rows.map(({ subject, cov, spec }) => {
          // honest denominator: use specPoint count when available, spec manifest otherwise, topics as last fallback
          const showStatements = cov.specPointsTotal > 0;
          const headline = showStatements
            ? `${cov.specPointsVerified}/${cov.specPointsTotal} statements verified · ${cov.statementCoverage}%`
            : `${cov.coveragePercent}% topic coverage`;
          const tone = showStatements
            ? cov.statementCoverage >= 85 ? "success" : cov.statementCoverage >= 50 ? "review" : undefined
            : cov.coveragePercent >= 90 ? "success" : cov.coveragePercent >= 70 ? "review" : undefined;
          const progress = showStatements ? cov.statementCoverage / 100 : cov.coveragePercent / 100;
          const totalStatements = spec?.statementsTotal ?? cov.specPointsTotal;
          return (
          <Panel key={subject.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {subject.name}{" "}
                <span className="font-normal text-ink3">
                  · {subject.specCode ?? subject.id} · {spec?.version ?? cov.specVersion ?? "—"}
                </span>
              </p>
              <Pill tone={tone}>
                {headline}
              </Pill>
            </div>

            <div className="mt-3">
              <ProgressBar value={progress} tone={progress >= 0.8 ? "success" : "accent"} />
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Topics</p>
                <p className="text-sm font-semibold tabular-nums">
                  {cov.topicsCovered}/{cov.topicsTotal}
                </p>
              </div>
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Statements</p>
                <p className="text-sm font-semibold tabular-nums">{cov.specPointsTotal || "—"}</p>
                <p className="text-[11px] text-ink3">of {totalStatements || "—"} spec</p>
              </div>
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Retrieval items</p>
                <p className="text-sm font-semibold tabular-nums">{cov.retrievalItems}</p>
                <p className="text-[11px] text-ink3">{cov.specPointsLearnable} statements with cards</p>
              </div>
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Exam questions</p>
                <p className="text-sm font-semibold tabular-nums">{cov.examQuestions}</p>
                <p className="text-[11px] text-ink3">{cov.specPointsAssessable} statements assessed</p>
              </div>
              <div className="card p-2">
                <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold">Last checked</p>
                <p className="text-sm font-semibold tabular-nums">{cov.lastChecked ?? spec?.lastChecked ?? "—"}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Pill>Topics: checked {cov.byVerification.checked ?? 0} · verified {cov.byVerification.verified ?? 0}/{cov.topicsTotal}</Pill>
              <Pill>Statements: checked {cov.byStatementVerification?.checked ?? 0} · verified {cov.specPointsVerified}/{cov.specPointsTotal}</Pill>
              {spec?.statementsTotal ? (
                <Pill tone="accent">
                  Spec {cov.specPointsTotal}/{spec.statementsTotal} statements authored
                </Pill>
              ) : null}
            </div>

            {cov.gaps.filter(g => g.kind === "no-spec-points").length ? (
              <p className="text-[11px] text-ink3 mt-2">
                {cov.gaps.filter((g) => g.kind === "no-spec-points").length} topics still need fine-grained spec points ·{" "}
                {cov.gaps.filter((g) => g.kind === "statement-no-questions").length} statements without an exam question yet
              </p>
            ) : cov.specPointsTotal ? (
              <p className="text-[11px] text-ink3 mt-2">
                {cov.specPointsVerified} verified statements; {cov.specPointsLearnable} have retrieval coverage, {cov.specPointsAssessable} have exam-question coverage.
              </p>
            ) : null}

            <p className="text-[11px] text-ink3 mt-2">
              {subject.name}: {spec ? `spec ${spec.specCode} v${spec.version}` : "no manifest"} · last checked{" "}
              {spec?.lastChecked ?? cov.lastChecked ?? "—"}
            </p>
          </Panel>
        )})}
      </div>

      <p className="text-[11px] text-ink3">
        Physics now shows honest statement-level coverage (each specPoint = one examinable claim, one stable ID, one AO, one provenance record). Other subjects already have topic-level provenance and are migrating statement-by-statement; their statement bar is 0 until authored. Run{" "}
        <code className="px-1 py-0.5 rounded bg-surface2">node scripts/validate-curriculum.mjs</code> in CI to block a
        coverage regression. Full totals: {allTopics().length} topics across {allSubjects().length} subjects.
      </p>
    </div>
  );
}
