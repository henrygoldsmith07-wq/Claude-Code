'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

type Stage = 'idea' | 'building' | 'shipped' | 'double-down' | 'killed';

interface Bet {
  id: string;
  name: string;
  stage: Stage;
}

const stages: { id: Stage; label: string; hint: string }[] = [
  { id: 'idea', label: '💡 Ideas', hint: 'Cheap bets waiting to be placed' },
  { id: 'building', label: '🔨 Building', hint: 'In progress right now' },
  { id: 'shipped', label: '🚀 Shipped', hint: 'Live — watch the signal' },
  { id: 'double-down', label: '📈 Double down', hint: 'Earning its keep — invest' },
  { id: 'killed', label: '🪦 Killed', hint: 'Fast no. Archive and move on' },
];

const seed: Bet[] = [
  { id: 'omni-life', name: 'Omni-Life', stage: 'building' },
  { id: 'wjec-study-app', name: 'WJEC Study Hub', stage: 'shipped' },
  { id: 'emotion-tracker', name: 'Emotion Tracker', stage: 'shipped' },
  { id: 'subscription-tracker', name: 'Subscription Tracker', stage: 'shipped' },
  { id: 'daily-debate', name: 'Daily Debate', stage: 'shipped' },
  { id: 'world-news', name: 'World News', stage: 'shipped' },
  { id: 'podcast-repurposer', name: 'Podcast Repurposer', stage: 'shipped' },
  { id: 'rtk', name: 'RTK', stage: 'shipped' },
];

export default function ShipPipelinePage() {
  const [bets, setBets] = useStoredState<Bet[]>('os.builder.pipeline', seed);
  const [name, setName] = useState('');

  const addIdea = () => {
    if (!name.trim()) return;
    setBets([...bets, { id: uid(), name: name.trim(), stage: 'idea' }]);
    setName('');
  };

  const move = (bet: Bet, dir: -1 | 1) => {
    const order = stages.map((s) => s.id);
    const next = order[order.indexOf(bet.stage) + dir];
    if (!next) return;
    setBets(bets.map((b) => (b.id === bet.id ? { ...b, stage: next } : b)));
  };

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Builder OS', href: '/os/builder' },
        { name: 'Ship Pipeline' },
      ]}
      icon="🚀"
      title="Ship Pipeline"
      tagline="Ideas → building → shipped → double down or kill."
    >
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="New idea — a cheap bet to place"
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addIdea()} />
          <button className={btnCls} onClick={addIdea}>Add idea</button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stages.map((stage) => (
          <div key={stage.id} className="bg-gray-950 border border-gray-800 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-white">{stage.label}</h2>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">{stage.hint}</p>
            <ul className="space-y-2">
              {bets.filter((b) => b.stage === stage.id).map((bet) => (
                <li key={bet.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                  <p className="text-sm text-gray-200 font-medium">{bet.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-2">
                      <button className="text-gray-500 hover:text-blue-400 text-xs"
                        onClick={() => move(bet, -1)} disabled={stage.id === 'idea'}>←</button>
                      <button className="text-gray-500 hover:text-blue-400 text-xs"
                        onClick={() => move(bet, 1)} disabled={stage.id === 'killed'}>→</button>
                    </div>
                    <button className={dangerBtnCls}
                      onClick={() => setBets(bets.filter((b) => b.id !== bet.id))}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </OsShell>
  );
}
