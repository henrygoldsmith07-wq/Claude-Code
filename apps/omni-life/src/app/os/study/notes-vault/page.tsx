'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

type Kind = 'note' | 'past-paper' | 'mark-scheme';

interface Entry {
  id: string;
  title: string;
  subject: string;
  kind: Kind;
  url: string;
}

const kindLabels: Record<Kind, string> = {
  note: '📝 Note',
  'past-paper': '📄 Past paper',
  'mark-scheme': '✅ Mark scheme',
};

export default function NotesVaultPage() {
  const [entries, setEntries] = useStoredState<Entry[]>('os.study.notes', []);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [kind, setKind] = useState<Kind>('note');
  const [url, setUrl] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterKind, setFilterKind] = useState<'all' | Kind>('all');

  const addEntry = () => {
    if (!title.trim()) return;
    setEntries([
      { id: uid(), title: title.trim(), subject: subject.trim() || 'General', kind, url: url.trim() },
      ...entries,
    ]);
    setTitle('');
    setUrl('');
  };

  const subjects = [...new Set(entries.map((e) => e.subject))].sort();
  const visible = entries.filter(
    (e) =>
      (filterSubject === 'all' || e.subject === filterSubject) &&
      (filterKind === 'all' || e.kind === filterKind)
  );

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Study OS', href: '/os/study' },
        { name: 'Notes Vault' },
      ]}
      icon="🗃️"
      title="Notes Vault"
      tagline="Class notes, past papers, and mark schemes — one indexed shelf."
    >
      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">File something</h2>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} placeholder="Title" value={title}
            onChange={(e) => setTitle(e.target.value)} />
          <input className={inputCls} placeholder="Subject" value={subject}
            onChange={(e) => setSubject(e.target.value)} />
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="note">Note</option>
            <option value="past-paper">Past paper</option>
            <option value="mark-scheme">Mark scheme</option>
          </select>
          <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Link (Drive, NotebookLM, PDF…)"
            value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className={btnCls} onClick={addEntry}>Add</button>
        </div>
      </section>

      <section className={panelCls}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-sm uppercase tracking-widest text-gray-500">Shelf</h2>
          <select className={inputCls} value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="all">All subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={inputCls} value={filterKind}
            onChange={(e) => setFilterKind(e.target.value as 'all' | Kind)}>
            <option value="all">All types</option>
            <option value="note">Notes</option>
            <option value="past-paper">Past papers</option>
            <option value="mark-scheme">Mark schemes</option>
          </select>
        </div>
        {visible.length === 0 && (
          <p className="text-sm text-gray-600">Nothing filed here yet.</p>
        )}
        <ul className="divide-y divide-gray-900">
          {visible.map((entry) => (
            <li key={entry.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                {entry.url ? (
                  <a href={entry.url} target="_blank" rel="noopener noreferrer"
                    className="text-white font-medium hover:text-blue-400">
                    {entry.title} <span className="text-gray-600 text-sm">↗</span>
                  </a>
                ) : (
                  <p className="text-white font-medium">{entry.title}</p>
                )}
                <p className="text-xs text-gray-600">{entry.subject} · {kindLabels[entry.kind]}</p>
              </div>
              <button className={dangerBtnCls}
                onClick={() => setEntries(entries.filter((e) => e.id !== entry.id))}>
                remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
