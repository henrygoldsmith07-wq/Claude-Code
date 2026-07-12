'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Card {
  id: string;
  front: string;
  back: string;
  right: number;
  wrong: number;
}

/** Prefer cards answered wrong more often; unseen cards first. */
function pickNext(cards: Card[], excludeId?: string): Card | null {
  const pool = cards.filter((c) => c.id !== excludeId);
  if (pool.length === 0) return cards[0] ?? null;
  const scored = [...pool].sort(
    (a, b) => (a.right - a.wrong) - (b.right - b.wrong) || (a.right + a.wrong) - (b.right + b.wrong)
  );
  return scored[0];
}

export default function QuickCardsPage() {
  const [cards, setCards] = useStoredState<Card[]>('os.study.quickcards', []);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  const current = cards.find((c) => c.id === currentId) ?? null;

  const addCard = () => {
    if (!front.trim() || !back.trim()) return;
    setCards([...cards, { id: uid(), front: front.trim(), back: back.trim(), right: 0, wrong: 0 }]);
    setFront('');
    setBack('');
  };

  const mark = (correct: boolean) => {
    if (!current) return;
    const updated = cards.map((c) =>
      c.id === current.id
        ? { ...c, right: c.right + (correct ? 1 : 0), wrong: c.wrong + (correct ? 0 : 1) }
        : c
    );
    setCards(updated);
    setFlipped(false);
    setCurrentId(pickNext(updated, current.id)?.id ?? null);
  };

  const startReview = () => {
    setFlipped(false);
    setCurrentId(pickNext(cards)?.id ?? null);
  };

  const totalReviews = cards.reduce((s, c) => s + c.right + c.wrong, 0);

  return (
    <OsShell
      crumbs={[
        { name: 'Life OS', href: '/os' },
        { name: 'Study OS', href: '/os/study' },
        { name: 'Quick Cards' },
      ]}
      icon="🃏"
      title="Quick Cards"
      tagline="Scrappy flashcards for today's facts — the full FSRS engine lives in the WJEC Study Hub."
    >
      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Add a card</h2>
        <div className="flex flex-wrap gap-3">
          <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Front (question)"
            value={front} onChange={(e) => setFront(e.target.value)} />
          <input className={`${inputCls} flex-1 min-w-[180px]`} placeholder="Back (answer)"
            value={back} onChange={(e) => setBack(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCard()} />
          <button className={btnCls} onClick={addCard}>Add</button>
        </div>
      </section>

      <section className={`${panelCls} text-center`}>
        {current === null ? (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {cards.length === 0 ? 'Add cards, then review.' : `${cards.length} cards · ${totalReviews} reviews so far`}
            </p>
            {cards.length > 0 && <button className={btnCls} onClick={startReview}>Start reviewing</button>}
          </>
        ) : (
          <>
            <button onClick={() => setFlipped(!flipped)}
              className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-10 hover:border-blue-500/40 transition-colors">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">
                {flipped ? 'Answer — tap to flip back' : 'Question — tap to reveal'}
              </p>
              <p className="text-xl text-white">{flipped ? current.back : current.front}</p>
            </button>
            <div className="flex justify-center gap-3 mt-5">
              {flipped ? (
                <>
                  <button className={`${btnCls} !text-red-400 !border-red-500/20 !bg-red-600/10 hover:!bg-red-600/20`}
                    onClick={() => mark(false)}>Got it wrong</button>
                  <button className={`${btnCls} !text-green-400 !border-green-500/20 !bg-green-600/10 hover:!bg-green-600/20`}
                    onClick={() => mark(true)}>Got it right</button>
                </>
              ) : (
                <button className={btnCls} onClick={() => setCurrentId(null)}>Stop</button>
              )}
            </div>
          </>
        )}
      </section>

      <section className={panelCls}>
        <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Deck</h2>
        {cards.length === 0 && <p className="text-sm text-gray-600">Empty deck.</p>}
        <ul className="divide-y divide-gray-900">
          {cards.map((c) => (
            <li key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-200 truncate">{c.front}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-green-400">{c.right}✓</span>
                <span className="text-red-400">{c.wrong}✗</span>
                <button className={dangerBtnCls}
                  onClick={() => setCards(cards.filter((x) => x.id !== c.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
