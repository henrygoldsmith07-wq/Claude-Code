'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

type Kind = 'book' | 'article' | 'video';
type Status = 'queued' | 'reading' | 'done';

interface Item {
  id: string;
  title: string;
  kind: Kind;
  status: Status;
  url: string;
}

const kindIcons: Record<Kind, string> = { book: '📕', article: '📰', video: '🎬' };
const nextStatus: Record<Status, Status> = { queued: 'reading', reading: 'done', done: 'queued' };
const statusCls: Record<Status, string> = {
  queued: 'text-gray-500', reading: 'text-blue-400', done: 'text-green-400',
};

export default function ReadingListPage() {
  const [items, setItems] = useStoredState<Item[]>('os.study.reading', []);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind>('book');
  const [url, setUrl] = useState('');

  const add = () => {
    if (!title.trim()) return;
    setItems([{ id: uid(), title: title.trim(), kind, status: 'queued', url: url.trim() }, ...items]);
    setTitle('');
    setUrl('');
  };

  const groups: Status[] = ['reading', 'queued', 'done'];

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Study OS', href: '/os/study' }, { name: 'Reading List' }]}
      icon="📖" title="Reading List" tagline="Books, articles, videos — queued, in progress, finished.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Title"
            value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="book">📕 Book</option>
            <option value="article">📰 Article</option>
            <option value="video">🎬 Video</option>
          </select>
          <input className={`${inputCls} flex-1 min-w-[160px]`} placeholder="Link (optional)"
            value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className={btnCls} onClick={add}>Add</button>
        </div>
      </section>

      {groups.map((status) => {
        const rows = items.filter((i) => i.status === status);
        return (
          <section key={status} className={panelCls}>
            <h2 className={`text-sm uppercase tracking-widest mb-4 ${statusCls[status]}`}>
              {status} · {rows.length}
            </h2>
            {rows.length === 0 && <p className="text-sm text-gray-600">Nothing here.</p>}
            <ul className="space-y-2">
              {rows.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-200">
                    {kindIcons[item.kind]}{' '}
                    {item.url
                      ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">{item.title} ↗</a>
                      : item.title}
                  </span>
                  <span className="flex items-center gap-2">
                    <button className={btnCls}
                      onClick={() => setItems(items.map((i) => i.id === item.id ? { ...i, status: nextStatus[i.status] } : i))}>
                      → {nextStatus[item.status]}
                    </button>
                    <button className={dangerBtnCls}
                      onClick={() => setItems(items.filter((i) => i.id !== item.id))}>✕</button>
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
