'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid, today } from '@/lib/os/storage';

interface Post {
  id: string;
  date: string;
  app: string;
  channel: string;
  note: string;
}

const channels = ['X / Twitter', 'Reddit', 'TikTok', 'Instagram', 'Product Hunt', 'Discord', 'School', 'Other'];

export default function MarketingLogPage() {
  const [posts, setPosts] = useStoredState<Post[]>('os.builder.marketing', []);
  const [app, setApp] = useState('');
  const [channel, setChannel] = useState(channels[0]);
  const [note, setNote] = useState('');

  const add = () => {
    if (!app.trim()) return;
    setPosts([{ id: uid(), date: today(), app: app.trim(), channel, note: note.trim() }, ...posts]);
    setNote('');
  };

  const month = today().slice(0, 7);
  const thisMonth = posts.filter((p) => p.date.startsWith(month)).length;

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Builder OS', href: '/os/builder' }, { name: 'Marketing Log' }]}
      icon="📣" title="Marketing Log" tagline="Apps don't get discovered — they get posted. Track every shot.">
      <section className={panelCls}>
        <div className="flex flex-wrap gap-3">
          <input className={inputCls} placeholder="App" value={app} onChange={(e) => setApp(e.target.value)} />
          <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value)}>
            {channels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="What + result (e.g. launch post, 40 visits)"
            value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className={btnCls} onClick={add}>Log</button>
          <span className="ml-auto text-sm text-gray-500 self-center">
            <span className="text-white font-semibold">{thisMonth}</span> this month
          </span>
        </div>
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">History</h2>
        {posts.length === 0 && <p className="text-sm text-gray-600">Nothing posted yet — the best app nobody sees still earns £0.</p>}
        <ul className="divide-y divide-gray-900">
          {posts.map((post) => (
            <li key={post.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200">
                {post.app} <span className="text-blue-400">via {post.channel}</span>
                {post.note && <span className="text-gray-500"> — {post.note}</span>}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-gray-600 text-xs">{post.date}</span>
                <button className={dangerBtnCls}
                  onClick={() => setPosts(posts.filter((p) => p.id !== post.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
