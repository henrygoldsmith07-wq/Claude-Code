'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

type Stage = 'queue' | 'learning' | 'learned';

interface Topic {
  id: string;
  topic: string;
  link: string;
  stage: Stage;
}

const next: Record<Stage, Stage> = { queue: 'learning', learning: 'learned', learned: 'queue' };
const stageCls: Record<Stage, string> = {
  queue: 'text-gray-500', learning: 'text-blue-400', learned: 'text-green-400',
};

export default function LearningLogPage() {
  const [topics, setTopics] = useStoredState<Topic[]>('os.builder.learning', []);
  const [topic, setTopic] = useState('');
  const [link, setLink] = useState('');

  const add = () => {
    if (!topic.trim()) return;
    setTopics([{ id: uid(), topic: topic.trim(), link: link.trim(), stage: 'queue' }, ...topics]);
    setTopic('');
    setLink('');
  };

  const stages: Stage[] = ['learning', 'queue', 'learned'];

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Builder OS', href: '/os/builder' }, { name: 'Learning Log' }]}
      icon="📚" title="Learning Log" tagline="Dev skills queued, in progress, and banked.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[220px]`} placeholder="Skill or topic (e.g. Supabase RLS, Stripe webhooks)"
            value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Resource link (optional)"
            value={link} onChange={(e) => setLink(e.target.value)} />
          <button className={btnCls} onClick={add}>Queue it</button>
        </div>
      </section>

      {stages.map((stage) => {
        const rows = topics.filter((t) => t.stage === stage);
        return (
          <section key={stage} className={panelCls}>
            <h2 className={`text-sm uppercase tracking-widest mb-4 ${stageCls[stage]}`}>{stage} · {rows.length}</h2>
            {rows.length === 0 && <p className="text-sm text-gray-600">None.</p>}
            <ul className="space-y-2">
              {rows.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-200">
                    {t.link
                      ? <a href={t.link} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">{t.topic} ↗</a>
                      : t.topic}
                  </span>
                  <span className="flex items-center gap-2">
                    <button className={btnCls}
                      onClick={() => setTopics(topics.map((x) => x.id === t.id ? { ...x, stage: next[x.stage] } : x))}>
                      → {next[t.stage]}
                    </button>
                    <button className={dangerBtnCls}
                      onClick={() => setTopics(topics.filter((x) => x.id !== t.id))}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </OsShell>
  );
}
