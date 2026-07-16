'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';
import { Bet, pipelineSeed, PIPELINE_KEY } from '@/lib/os/pipeline';

interface Idea {
  id: string;
  name: string;
  impact: number; // 1-5
  effort: number; // 1-5
  note: string;
}

const scale = [1, 2, 3, 4, 5];

export default function IdeaVaultPage() {
  const [ideas, setIdeas] = useStoredState<Idea[]>('os.builder.ideas', []);
  const [pipeline, setPipeline] = useStoredState<Bet[]>(PIPELINE_KEY, pipelineSeed);
  const [name, setName] = useState('');
  const [impact, setImpact] = useState(3);
  const [effort, setEffort] = useState(3);
  const [note, setNote] = useState('');

  const addIdea = () => {
    if (!name.trim()) return;
    setIdeas([...ideas, { id: uid(), name: name.trim(), impact, effort, note: note.trim() }]);
    setName('');
    setNote('');
  };

  const promote = (idea: Idea) => {
    setPipeline([...pipeline, { id: uid(), name: idea.name, stage: 'idea' }]);
    setIdeas(ideas.filter((i) => i.id !== idea.id));
  };

  const ranked = [...ideas].sort(
    (a, b) => b.impact / b.effort - a.impact / a.effort || b.impact - a.impact
  );

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Builder OS', href: '/os/builder' },
        { name: 'Idea Vault' },
      ]}
      icon="💡"
      title="Idea Vault"
      tagline="Capture everything, score impact vs effort, promote the best bets to the pipeline."
    >
      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Capture an idea</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="The idea, one line"
            value={name} onChange={(e) => setName(e.target.value)} />
          <label className="text-xs text-gray-500">Impact
            <select className={`${inputCls} ml-2`} value={impact} onChange={(e) => setImpact(+e.target.value)}>
              {scale.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">Effort
            <select className={`${inputCls} ml-2`} value={effort} onChange={(e) => setEffort(+e.target.value)}>
              {scale.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Note (optional)"
            value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btnCls} onClick={addIdea}>Vault it</button>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">
          Ranked by impact ÷ effort
        </h2>
        {ranked.length === 0 && (
          <p className="text-sm text-gray-600">Empty vault — capture ideas the moment they happen, judge them later.</p>
        )}
        <ul className="space-y-3">
          {ranked.map((idea) => (
            <li key={idea.id} className="flex flex-wrap items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div>
                <p className="text-sm text-gray-200 font-medium">{idea.name}</p>
                <p className="text-xs text-gray-600">
                  impact {idea.impact} · effort {idea.effort} · ratio {(idea.impact / idea.effort).toFixed(1)}
                  {idea.note && ` — ${idea.note}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className={btnCls} onClick={() => promote(idea)}>→ Pipeline</button>
                <button className={dangerBtnCls}
                  onClick={() => setIdeas(ideas.filter((i) => i.id !== idea.id))}>✕</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
