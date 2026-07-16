'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today, daysUntil } from '@/lib/os/storage';

interface Exam {
  id: string;
  subject: string;
  paper: string;
  date: string; // YYYY-MM-DD
}

function countdownColor(days: number): string {
  if (days < 0) return 'text-gray-600';
  if (days <= 7) return 'text-red-400';
  if (days <= 30) return 'text-yellow-400';
  return 'text-green-400';
}

/** Next 7 days, two subjects per day, soonest exams first in the rotation. */
function weeklyPlan(exams: Exam[]): { date: string; label: string; subjects: string[] }[] {
  const upcoming = exams.filter((e) => daysUntil(e.date) >= 0);
  const firstExam = new Map<string, string>();
  for (const e of upcoming) {
    const prev = firstExam.get(e.subject);
    if (!prev || e.date < prev) firstExam.set(e.subject, e.date);
  }
  const subjects = [...firstExam.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([s]) => s);
  if (subjects.length === 0) return [];

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today() + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const picks = subjects.length === 1
      ? [subjects[0]]
      : [subjects[(2 * i) % subjects.length], subjects[(2 * i + 1) % subjects.length]];
    return {
      date,
      label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      subjects: [...new Set(picks)],
    };
  });
}

export default function ExamPlannerPage() {
  const [exams, setExams] = useStoredState<Exam[]>('os.study.exams', []);
  const [subject, setSubject] = useState('');
  const [paper, setPaper] = useState('');
  const [date, setDate] = useState('');

  const addExam = () => {
    if (!subject.trim() || !date) return;
    setExams([...exams, { id: uid(), subject: subject.trim(), paper: paper.trim(), date }]);
    setSubject('');
    setPaper('');
    setDate('');
  };

  const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));
  const plan = weeklyPlan(exams);

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Study OS', href: '/os/study' },
        { name: 'Exam Planner' },
      ]}
      icon="⏳"
      title="Exam Planner"
      tagline="Exam dates, countdowns, and a rolling revision rotation."
    >
      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Add an exam</h2>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} placeholder="Subject (e.g. Chemistry)" value={subject}
            onChange={(e) => setSubject(e.target.value)} />
          <input className={inputCls} placeholder="Paper (e.g. Unit 3)" value={paper}
            onChange={(e) => setPaper(e.target.value)} />
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className={btnCls} onClick={addExam}>Add exam</button>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={panelCls}>
          <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Countdowns</h2>
          {sorted.length === 0 && (
            <p className="text-sm text-gray-600">No exams yet — add your WJEC papers above.</p>
          )}
          <ul className="space-y-3">
            {sorted.map((exam) => {
              const days = daysUntil(exam.date);
              return (
                <li key={exam.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">
                      {exam.subject}{exam.paper && <span className="text-gray-500"> · {exam.paper}</span>}
                    </p>
                    <p className="text-xs text-gray-600">{exam.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${countdownColor(days)}`}>
                      {days < 0 ? 'done' : days === 0 ? 'today' : `${days}d`}
                    </span>
                    <button className={dangerBtnCls}
                      onClick={() => setExams(exams.filter((e) => e.id !== exam.id))}>
                      remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={panelCls}>
          <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">This week&apos;s rotation</h2>
          {plan.length === 0 ? (
            <p className="text-sm text-gray-600">
              Add upcoming exams and a 7-day revision rotation appears here, weighted so the
              soonest exams lead the cycle.
            </p>
          ) : (
            <ul className="space-y-2">
              {plan.map((day) => (
                <li key={day.date} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{day.label}</span>
                  <span className="text-gray-200">{day.subjects.join(' + ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </OsShell>
  );
}
