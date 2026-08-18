"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getSubject, getTopic, topicsFor } from "@/domain/curriculum";
import { useStore } from "@/state/store";
import { Button, Panel, Pill, ProgressBar, SectionHeading, StatTile } from "./ui";

// The eight-slice assessment view — every panel answers a concrete question a
// student would ask about an exam, not about the app.

function EmptyHint({ children }: { children: string }) {
  return <p className="text-xs text-ink3">{children}</p>;
}

export function ExpectedMarksCard() {
  const store = useStore();
  const insight = store.assessment;
  if (!insight || !insight.expectedMarksPerHour.length) {
    return (
      <Panel>
        <SectionHeading
          title="Expected exam marks per study hour"
          hint="The headline metric. Answer a few exam questions and the numbers appear here."
        />
        <EmptyHint>Do a set of marked questions in each subject — every dropped mark teaches the engine where an hour of work converts fastest.</EmptyHint>
      </Panel>
    );
  }
  const top = insight.expectedMarksPerHour.slice(0, 6);
  const max = Math.max(0.5, ...top.map((r) => r.value));
  return (
    <Panel>
      <SectionHeading
        title="Expected exam marks per study hour"
        hint="If you spend the next hour on one topic, how many exam marks does the model think it buys? Ranked, not averaged."
      />
      <ul className="space-y-2.5">
        {top.map((row) => {
          const topic = getTopic(row.topicId);
          const subject = topic ? getSubject(topic.subjectId) : null;
          return (
            <li key={row.topicId} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <Link href={`/practice?topic=${encodeURIComponent(row.topicId)}`} className="text-sm text-ink truncate hover:underline">
                    {topic?.title ?? row.topicId}
                  </Link>
                  <span className="text-[11px] text-ink3 shrink-0">{subject?.name}</span>
                </div>
                <div className="mt-1.5 max-w-sm">
                  <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                    <div className="h-full bg-accent rounded-full bar-anim" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums text-accent shrink-0">+{row.value.toFixed(1)}</span>
              <Link href={`/practice?topic=${encodeURIComponent(row.topicId)}`}>
                <Button size="sm">Fix</Button>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-ink3 mt-3">
        Built from your real dropped marks and current mastery. A topic at 40% with 6 lost marks converts faster than one at 85% with one slip.
      </p>
    </Panel>
  );
}

export function MarksLostByCause() {
  const insight = useStore().assessment;
  if (!insight) return null;
  const byCategory = [
    ...Object.entries(insight.byMisconception).filter(([, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number)),
    ...Object.entries(insight.byCommand).filter(([, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 2),
  ];
  const total = Object.values(insight.byMisconception).reduce((a, v) => a + (v as number), 0) +
    Object.values(insight.byCommand).reduce((a, v) => a + (v as number), 0);
  if (!total) return null;
  // Show misconception + command breakdown in one card so the student sees both without two panels.
  const misconRows = Object.entries(insight.byMisconception).filter(([, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number));
  const commandRows = Object.entries(insight.byCommand).filter(([, v]) => (v as number) > 0).sort((a, b) => (b[1] as number) - (a[1] as number));
  void byCategory;
  return (
    <Panel>
      <SectionHeading title="Marks lost by cause" hint="Command words, misconception types, and timing." />
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mb-2">Misconception</p>
          {misconRows.length ? (
            <ul className="space-y-1.5">
              {misconRows.slice(0, 6).map(([tag, marks]) => (
                <li key={tag} className="flex justify-between gap-2 text-xs">
                  <span className="text-ink2">{tag}</span>
                  <span className="tabular-nums text-danger font-semibold">{marks as number} marks</span>
                </li>
              ))}
            </ul>
          ) : <EmptyHint>Not enough classified mistakes yet.</EmptyHint>}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mb-2">Command word</p>
          {commandRows.length ? (
            <ul className="space-y-1.5">
              {commandRows.slice(0, 6).map(([word, marks]) => (
                <li key={word} className="flex justify-between gap-2 text-xs">
                  <span className="text-ink2">{word}</span>
                  <span className="tabular-nums text-review font-semibold">{marks as number} marks</span>
                </li>
              ))}
            </ul>
          ) : <EmptyHint>Answer a question with a verb-led prompt to populate this.</EmptyHint>}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-line">
        <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mb-2">By assessment objective</p>
        <div className="flex flex-wrap gap-1.5">
          {(["AO1", "AO2", "AO3"] as const).map((ao) => (
            <Pill key={ao} tone={(insight.marksLostByAo[ao] ?? 0) > 0 ? "danger" : "neutral"}>
              {ao}: {(insight.marksLostByAo[ao] ?? 0)} marks
            </Pill>
          ))}
        </div>
      </div>
      {/* timing */}
      <div className="mt-3">
        <TimingBreakdown />
      </div>
    </Panel>
  );
}

export function RecurringMisconceptions() {
  const store = useStore();
  const rows = store.recurringMisconceptions;
  if (!rows.length) {
    return (
      <Panel>
        <SectionHeading
          title="Recurring misconceptions"
          hint="Specific wrong beliefs you keep losing marks on, drawn from the misconception library."
        />
        <EmptyHint>Answer some questions — matched misconceptions appear here with their explanations.</EmptyHint>
      </Panel>
    );
  }
  return (
    <Panel>
      <SectionHeading
        title="Recurring misconceptions"
        hint="The specific wrong beliefs you hit most often, linked to their full explanation."
      />
      <ul className="card divide-y divide-line">
        {rows.slice(0, 5).map(({ entry, count }) => {
          const subject = getSubject(entry.subjectId);
          const topic = getTopic(entry.topicIds[0] ?? "");
          return (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/library?topic=${encodeURIComponent(entry.topicIds[0] ?? "")}&misconception=${encodeURIComponent(entry.id)}`}
                  className="text-sm font-semibold text-ink hover:underline"
                >
                  {entry.statement}
                </Link>
                <Pill tone="danger">{count}×</Pill>
              </div>
              <p className="text-[11px] text-ink3 mt-1">
                {subject?.name ?? entry.subjectId}
                {topic ? ` · ${topic.title}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function TimingBreakdown() {
  const store = useStore();
  const byTiming: Record<string, number> = { ok: 0, rushed: 0, slow: 0, unknown: 0 };
  for (const m of store.mistakes.filter((x) => !x.resolved)) byTiming[m.timing ?? "unknown"] = (byTiming[m.timing ?? "unknown"] ?? 0) + m.marksLost;
  const total = (byTiming.rushed ?? 0) + (byTiming.slow ?? 0) + (byTiming.ok ?? 0);
  if (!total) return null;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mr-1">Timing</span>
      <Pill tone={byTiming.rushed ? "danger" : "neutral"}>Rushed {byTiming.rushed}m</Pill>
      <Pill tone={byTiming.slow ? "review" : "neutral"}>Slow {byTiming.slow}m</Pill>
      <Pill>On time {byTiming.ok}m</Pill>
    </div>
  );
}

export function DifficultyAndSubtopics() {
  const store = useStore();
  const insight = store.assessment;
  const weakRepeated = insight?.repeatedWeakSubtopics ?? [];
  // Difficulty slice: average difficulty where marks were lost vs where they weren't
  const byDifficulty: Record<number, { lost: number; attempts: number }> = {};
  for (const a of store.attempts) {
    const q = store.questions.find((qq) => qq.id === a.questionId);
    const d = q?.difficulty ?? 3;
    const row = byDifficulty[d] ?? { lost: 0, attempts: 0 };
    row.lost += a.max - a.awarded;
    row.attempts += a.max;
    byDifficulty[d] = row;
  }
  const difficultyRows = Object.entries(byDifficulty).sort((a, b) => Number(a[0]) - Number(b[0]));
  const hasDifficulty = difficultyRows.length > 0;
  const hasRepeated = weakRepeated.length > 0;

  if (!hasDifficulty && !hasRepeated) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Panel>
        <SectionHeading title="Question difficulty" hint="Where the marks actually drop as difficulty rises." />
        {hasDifficulty ? (
          <ul className="space-y-1.5">
            {difficultyRows.map(([level, row]) => {
              const rate = row.attempts ? row.lost / row.attempts : 0;
              return (
                <li key={level} className="flex items-center gap-2 text-xs">
                  <span className="w-10 text-ink3">Level {level}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden">
                    <div className="h-full bg-review bar-anim rounded-full" style={{ width: `${Math.round(rate * 100)}%` }} />
                  </div>
                  <span className="tabular-nums w-16 text-right text-ink2">{row.lost}/{row.attempts} lost</span>
                </li>
              );
            })}
          </ul>
        ) : <EmptyHint>Answer a few questions across difficulties.</EmptyHint>}
      </Panel>
      <Panel>
        <SectionHeading title="Repeated weak subtopics" hint="Topics that cost marks again and again — not a one-off slip." />
        {hasRepeated ? (
          <ul className="space-y-1">
            {weakRepeated.slice(0, 8).map((id) => {
              const t = getTopic(id);
              return (
                <li key={id} className="flex justify-between gap-2 text-xs">
                  <span className="text-ink truncate">{t?.title ?? id}</span>
                  <Link href={`/practice?topic=${encodeURIComponent(id)}`} className="shrink-0"><Button size="sm">Practise</Button></Link>
                </li>
              );
            })}
          </ul>
        ) : <EmptyHint>No topic has cost you marks three times while still weak. That is a good sign.</EmptyHint>}
        {insight?.marksLostByTopic.length ? (
          <div className="mt-3 pt-3 border-t border-line">
            <p className="text-[11px] uppercase tracking-wide text-ink3 font-semibold mb-1.5">Marks lost by topic</p>
            <ul className="space-y-1">
              {insight.marksLostByTopic.slice(0, 6).map((row) => (
                <li key={row.topicId} className="flex justify-between gap-2 text-xs">
                  <span className="text-ink2 truncate">{getTopic(row.topicId)?.title ?? row.topicId}</span>
                  <span className="tabular-nums shrink-0 text-danger">{row.lost} lost · {row.recoverable} recoverable</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

export function PaperSimulationCard() {
  const store = useStore();
  const subjects = store.settings.subjectIds.map((id) => {
    const s = getSubject(id);
    return s ? { id: s.id, name: s.name, papers: s.papers } : null;
  }).filter(Boolean) as Array<{ id: string; name: string; papers: { id: string; name: string; durationMinutes: number }[] }>;
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [paperSpecId, setPaperSpecId] = useState(subjects[0]?.papers[0]?.id ?? "");
  const subject = subjects.find((s) => s.id === subjectId);
  const questions = store.questions.filter((q) => q.subjectId === subjectId);
  const simulation = useMemo(() => {
    if (!subjectId || !paperSpecId || !questions.length) return null;
    // Simulate against a full-paper-sized slice (up to 40 marks worth)
    const slice: string[] = [];
    let marks = 0;
    for (const q of questions) {
      slice.push(q.id);
      marks += q.totalMarks;
      if (marks >= 40) break;
    }
    return store.previewPaper(subjectId, paperSpecId, slice);
  }, [store, subjectId, paperSpecId, questions]);

  if (!subjects.length) return null;

  return (
    <Panel>
      <SectionHeading title="Exam-paper simulation" hint="Predicted marks for a timed paper, with calibration for your optimism." />
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); const s = subjects.find((x) => x.id === e.target.value); setPaperSpecId(s?.papers[0]?.id ?? ""); }} className="field field-inline text-sm">
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={paperSpecId} onChange={(e) => setPaperSpecId(e.target.value)} className="field field-inline text-sm">
          {(subject?.papers ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.durationMinutes}m</option>)}
        </select>
      </div>
      {!simulation ? <EmptyHint>Need at least one question in this subject to simulate a paper.</EmptyHint> : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <StatTile label="Predicted" value={`${simulation.predictedMarks}/${simulation.totalMarks}`} sub={`Grade ${simulation.predictedGrade}`} tone={simulation.predictedMarks / Math.max(1, simulation.totalMarks) >= 0.7 ? "success" : "review"} />
            <StatTile label="Time allowed" value={`${simulation.timeMinutes}m`} sub={subject?.papers.find((p) => p.id === paperSpecId)?.name ?? ""} />
            <StatTile label="Recoverable" value={`+${simulation.recoverableMarks}`} sub="with 1h per weak topic" tone="success" />
          </div>
          <div>
            <ProgressBar value={simulation.totalMarks ? simulation.predictedMarks / simulation.totalMarks : 0} tone={simulation.predictedMarks / Math.max(1, simulation.totalMarks) >= 0.7 ? "success" : "review"} />
          </div>
          {simulation.marksByTopic.length ? (
            <ul className="mt-3 space-y-1">
              {simulation.marksByTopic.slice(0, 8).map((row) => (
                <li key={row.topicId} className="flex justify-between gap-2 text-xs">
                  <span className="text-ink2 truncate">{getTopic(row.topicId)?.title ?? row.topicId}</span>
                  <span className="tabular-nums shrink-0">{row.expected}/{row.available} expected</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-[11px] text-ink3 mt-3">
            Uses your current topic mastery, re-weighted by calibration (see below). <Link href="/papers" className="underline">Sit a real paper</Link> to tighten the prediction.
          </p>
        </>
      )}
    </Panel>
  );
}

export function CalibrationCard() {
  const store = useStore();
  const rows = [...store.calibrations.values()].filter((c) => c.sampleSize > 0);
  return (
    <Panel>
      <SectionHeading title="Actual vs predicted — calibration" hint="How honest the predictions are. Needs three sat papers per subject." />
      {!rows.length ? (
        <EmptyHint>Sit three papers in the same subject and the calibration appears here — bias, slope and mean error are then shown per subject.</EmptyHint>
      ) : (
        <ul className="divide-y divide-line card overflow-hidden">
          {rows.map((c) => {
            const subject = getSubject(c.subjectId);
            return (
              <li key={c.subjectId} className="px-4 py-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-ink min-w-[7rem]">{subject?.name ?? c.subjectId}</span>
                <Pill>n={c.sampleSize}</Pill>
                <span className="text-ink2">bias {c.bias >= 0 ? "+" : ""}{c.bias.toFixed(1)}</span>
                <span className="text-ink2">slope {c.slope.toFixed(2)}</span>
                <span className="text-ink3">MAE {c.mae.toFixed(1)}</span>
                {Math.abs(c.bias) < 1 && Math.abs(c.slope - 1) < 0.15 ? <Pill tone="success">Well calibrated</Pill> : <Pill tone="review">Drifting</Pill>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
