'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Result {
  id: string;
  date: string;
  subject: string;
  paper: string;
  scorePct: number;
}

function gradeColor(pct: number): string {
  if (pct >= 80) return 'text-green-400';
  if (pct >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

export default function GradeTrackerPage() {
  const [results, setResults] = useStoredState<Result[]>('os.study.grades', []);
  const [date, setDate] = useState(today());
  const [subject, setSubject] = useState('');
  const [paper, setPaper] = useState('');
  const [score, setScore] = useState('');

  const addResult = () => {
    const pct = parseFloat(score);
    if (!subject.trim() || isNaN(pct) || pct < 0 || pct > 100) return;
    setResults([
      { id: uid(), date, subject: subject.trim(), paper: paper.trim(), scorePct: pct },
      ...results,
    ]);
    setPaper('');
    setScore('');
  };

  const subjects = [...new Set(results.map((r) => r.subject))].sort();
  const bySubject = subjects.map((name) => {
    const rows = results
      .filter((r) => r.subject === name)
      .sort((a, b) => a.date.localeCompare(b.date));
    const avg = rows.reduce((s, r) => s + r.scorePct, 0) / rows.length;
    const latest = rows[rows.length - 1].scorePct;
    const prev = rows.length > 1 ? rows[rows.length - 2].scorePct : null;
    return { name, avg, latest, trend: prev === null ? null : latest - prev, count: rows.length };
  });

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Study OS', href: '/os/study' },
        { name: 'Grade Tracker' },
      ]}
      icon="📊"
      title="Grade Tracker"
      tagline="Every mock and test mark, per subject, with the trend visible."
    >
      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Log a result</h2>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={inputCls} placeholder="Subject" value={subject}
            onChange={(e) => setSubject(e.target.value)} />
          <input className={inputCls} placeholder="Paper / topic" value={paper}
            onChange={(e) => setPaper(e.target.value)} />
          <input className={inputCls} type="number" min="0" max="100" placeholder="Score %"
            value={score} onChange={(e) => setScore(e.target.value)} />
          <button className={btnCls} onClick={addResult}>Add</button>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Per subject</h2>
        {bySubject.length === 0 && <p className="text-sm text-gray-600">No results yet.</p>}
        <ul className="space-y-3">
          {bySubject.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-gray-200 font-medium">{s.name}
                <span className="text-gray-600 text-xs ml-2">{s.count} result{s.count === 1 ? '' : 's'}</span>
              </span>
              <span className="flex items-center gap-4">
                <span className="text-gray-500">avg <span className={gradeColor(s.avg)}>{s.avg.toFixed(0)}%</span></span>
                <span className="text-gray-500">latest <span className={gradeColor(s.latest)}>{s.latest.toFixed(0)}%</span></span>
                {s.trend !== null && (
                  <span className={s.trend >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {s.trend >= 0 ? '▲' : '▼'} {Math.abs(s.trend).toFixed(0)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">All results</h2>
        <ul className="divide-y divide-gray-900">
          {results.map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="text-gray-200">{r.subject}</span>
                <span className="text-gray-600 text-xs ml-2">{r.paper && `${r.paper} · `}{r.date}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-semibold ${gradeColor(r.scorePct)}`}>{r.scorePct}%</span>
                <button className={dangerBtnCls}
                  onClick={() => setResults(results.filter((x) => x.id !== r.id))}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
