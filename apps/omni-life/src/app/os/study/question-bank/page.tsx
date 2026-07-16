'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Question {
  id: string;
  q: string;
  subject: string;
  resolved: boolean;
}

export default function QuestionBankPage() {
  const [questions, setQuestions] = useStoredState<Question[]>('os.study.questions', []);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');

  const add = () => {
    if (!q.trim()) return;
    setQuestions([{ id: uid(), q: q.trim(), subject: subject.trim() || 'General', resolved: false }, ...questions]);
    setQ('');
  };

  const open = questions.filter((x) => !x.resolved);
  const resolved = questions.filter((x) => x.resolved);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Study OS', href: '/os/study' }, { name: 'Question Bank' }]}
      icon="❓" title="Question Bank" tagline="Confusions captured before they cost marks — take them to class.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[240px]`} placeholder="What don't you get?"
            value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <input className={inputCls} placeholder="Subject" value={subject}
            onChange={(e) => setSubject(e.target.value)} />
          <button className={btnCls} onClick={add}>Bank it</button>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-yellow-400 mb-4">Open · {open.length}</h2>
        {open.length === 0 && <p className="text-sm text-gray-600">No open questions — everything makes sense (for now).</p>}
        <ul className="space-y-2">
          {open.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">{item.q}
                <span className="text-gray-600 text-xs ml-2">{item.subject}</span>
              </span>
              <span className="flex items-center gap-2">
                <button className={btnCls}
                  onClick={() => setQuestions(questions.map((x) => x.id === item.id ? { ...x, resolved: true } : x))}>
                  Resolved
                </button>
                <button className={dangerBtnCls}
                  onClick={() => setQuestions(questions.filter((x) => x.id !== item.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-green-400 mb-4">Resolved · {resolved.length}</h2>
        <ul className="divide-y divide-gray-900">
          {resolved.map((item) => (
            <li key={item.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-500 line-through">{item.q}</span>
              <button className={dangerBtnCls}
                onClick={() => setQuestions(questions.filter((x) => x.id !== item.id))}>✕</button>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
