'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

type Verdict = 'running' | 'won' | 'lost';

interface Experiment {
  id: string;
  hypothesis: string;
  result: string;
  status: Verdict;
}

const statusCls: Record<Verdict, string> = {
  running: 'text-blue-400', won: 'text-green-400', lost: 'text-red-400',
};

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useStoredState<Experiment[]>('os.builder.experiments', []);
  const [hypothesis, setHypothesis] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});

  const add = () => {
    if (!hypothesis.trim()) return;
    setExperiments([{ id: uid(), hypothesis: hypothesis.trim(), result: '', status: 'running' }, ...experiments]);
    setHypothesis('');
  };

  const close = (exp: Experiment, status: Verdict) =>
    setExperiments(experiments.map((e) =>
      e.id === exp.id ? { ...e, status, result: (results[exp.id] ?? '').trim() } : e
    ));

  const groups: Verdict[] = ['running', 'won', 'lost'];

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Builder OS', href: '/os/builder' }, { name: 'Experiments' }]}
      icon="🧪" title="Experiments" tagline='State the bet before you run it: "If I do X, Y happens."'>
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[260px]`}
            placeholder='Hypothesis (e.g. "Posting WJEC app in 3 school groups gets 20 signups")'
            value={hypothesis} onChange={(e) => setHypothesis(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className={btnCls} onClick={add}>Start experiment</button>
        </div>
      </section>

      {groups.map((status) => {
        const rows = experiments.filter((e) => e.status === status);
        return (
          <section key={status} className={panelCls}>
            <h2 className={`text-sm uppercase tracking-widest mb-4 ${statusCls[status]}`}>
              {status} · {rows.length}
            </h2>
            {rows.length === 0 && <p className="text-sm text-gray-600">None.</p>}
            <ul className="space-y-3">
              {rows.map((exp) => (
                <li key={exp.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-200">{exp.hypothesis}</p>
                    <button className={dangerBtnCls}
                      onClick={() => setExperiments(experiments.filter((e) => e.id !== exp.id))}>✕</button>
                  </div>
                  {exp.status === 'running' ? (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Result (optional)"
                        value={results[exp.id] ?? ''}
                        onChange={(e) => setResults({ ...results, [exp.id]: e.target.value })} />
                      <button className={`${btnCls} !text-green-400 !border-green-500/20 !bg-green-600/10`}
                        onClick={() => close(exp, 'won')}>Won</button>
                      <button className={`${btnCls} !text-red-400 !border-red-500/20 !bg-red-600/10`}
                        onClick={() => close(exp, 'lost')}>Lost</button>
                    </div>
                  ) : (
                    exp.result && <p className="text-xs text-gray-500 mt-2">→ {exp.result}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </OsShell>
  );
}
