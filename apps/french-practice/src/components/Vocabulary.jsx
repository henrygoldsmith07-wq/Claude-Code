import { useMemo, useState } from 'react';
import { VOCAB_PACKS, getPack, allEntries } from '../lib/vocab';
import {
  getSrs, rateCard, isCardDue,
  getNotebook, isInNotebook, saveToNotebook, removeFromNotebook,
} from '../lib/storage';
import VocabCard from './VocabCard';
import Memory from './Memory';
import { weakEntries, notebookAsEntries, reviewOrder } from '../lib/memory';
import { SpeakButton } from './ui';
import { ChevronLeft, ChevronRight, Layers, Book, Plus, Trash, BarChart, Clock } from './icons';

// Vocabulary hub: themed packs, a cross-pack SRS review queue, the personal
// notebook of saved/custom words, and the memory & revision dashboard.

export default function Vocabulary({ apiKey, mockMode, onActivity, onXp }) {
  const [view, setView] = useState({ mode: 'packs' }); // packs | deck | notebook | memory
  const [srsTick, setSrsTick] = useState(0);
  const [nbTick, setNbTick] = useState(0);
  const srs = useMemo(() => getSrs(), [srsTick]);
  const notebook = useMemo(() => getNotebook(), [nbTick]);

  const dueTotal = [...allEntries(), ...notebookAsEntries(notebook)]
    .filter((e) => isCardDue(srs[e.id])).length;

  if (view.mode === 'memory') {
    return (
      <Memory
        onBack={() => setView({ mode: 'packs' })}
        onOpenDeck={(packId) => setView({ mode: 'deck', packId })}
        onXp={onXp}
      />
    );
  }

  if (view.mode === 'deck') {
    return (
      <Deck
        packId={view.packId}
        onBack={() => setView({ mode: 'packs' })}
        srs={srs}
        onRated={() => setSrsTick((t) => t + 1)}
        onSavedChange={() => setNbTick((t) => t + 1)}
        apiKey={apiKey}
        mockMode={mockMode}
        onActivity={onActivity}
      />
    );
  }

  if (view.mode === 'notebook') {
    return (
      <Notebook
        notebook={notebook}
        onBack={() => setView({ mode: 'packs' })}
        onChange={() => setNbTick((t) => t + 1)}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink">Vocabulary</h2>
          <p className="text-xs text-ink2 mt-1">
            {dueTotal > 0 ? `${dueTotal} words due for review` : 'All caught up — explore a pack'}
          </p>
        </div>

        {/* review queue across every pack */}
        {dueTotal > 0 && (
          <button
            onClick={() => setView({ mode: 'deck', packId: 'review' })}
            className="w-full flex items-center gap-3.5 bg-accent text-onaccent rounded-2xl px-4 py-3.5 text-left hover:opacity-90 transition-opacity"
          >
            <BarChart size={18} className="shrink-0" />
            <span className="flex-1">
              <span className="block text-sm font-semibold">Review due words</span>
              <span className="block text-xs opacity-70">Interleaved across packs — most-forgotten first</span>
            </span>
            <span className="shrink-0 min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-onaccent text-accent text-xs font-semibold">
              {dueTotal}
            </span>
          </button>
        )}

        {/* memory & revision dashboard */}
        <button
          onClick={() => setView({ mode: 'memory' })}
          className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
        >
          <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><Clock size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">Memory & revision</span>
            <span className="block text-xs text-ink3">Forgetting curves, weak words, mistakes, heatmap</span>
          </span>
          <ChevronRight size={16} className="text-ink3 shrink-0" />
        </button>

        {/* notebook */}
        <button
          onClick={() => setView({ mode: 'notebook' })}
          className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
        >
          <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><Book size={18} /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-ink">My notebook</span>
            <span className="block text-xs text-ink3">
              {notebook.length ? `${notebook.length} saved word${notebook.length > 1 ? 's' : ''}` : 'Save any word with one tap'}
            </span>
          </span>
          <ChevronRight size={16} className="text-ink3 shrink-0" />
        </button>

        {/* themed packs */}
        <div className="grid grid-cols-2 gap-2.5">
          {VOCAB_PACKS.map((p) => {
            const due = p.entries.filter((e) => isCardDue(srs[e.id])).length;
            return (
              <button
                key={p.id}
                onClick={() => setView({ mode: 'deck', packId: p.id })}
                className="relative bg-surface border border-line rounded-2xl p-4 text-left hover:border-ink3 transition-colors"
              >
                {due > 0 && (
                  <span className="absolute top-3 right-3 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-surface2 text-ink2 text-[10px] font-semibold tabular-nums">
                    {due}
                  </span>
                )}
                <Layers size={16} className="text-ink2 mb-2" />
                <span className="block text-sm font-semibold text-ink">{p.title}</span>
                <span className="block text-[11px] text-ink3 mt-0.5 leading-snug">{p.description}</span>
                <span className="block text-[10px] text-ink3 mt-1.5">{p.entries.length} words</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Deck({ packId, onBack, srs, onRated, onSavedChange, apiKey, mockMode, onActivity }) {
  const [index, setIndex] = useState(0);
  const [savedTick, setSavedTick] = useState(0);

  // Virtual packs: 'review' = every due card (packs + notebook), 'weak' =
  // high-lapse stumblers, 'notebook' = the learner's custom flashcards.
  const deck = useMemo(() => {
    const initial = getSrs();
    const library = () => [...allEntries(), ...notebookAsEntries(getNotebook())];
    if (packId === 'review') {
      // Science-based order: review what you're closest to forgetting first.
      const due = library().filter((e) => isCardDue(initial[e.id]));
      return reviewOrder(due, initial);
    }
    if (packId === 'weak') return weakEntries(library(), initial);
    if (packId === 'notebook') return notebookAsEntries(getNotebook());
    const pack = getPack(packId);
    return [...pack.entries].sort((a, b) => {
      const aDue = isCardDue(initial[a.id]);
      const bDue = isCardDue(initial[b.id]);
      return aDue === bDue ? 0 : aDue ? -1 : 1;
    });
  }, [packId]);

  const title =
    packId === 'review' ? 'Review queue'
    : packId === 'weak' ? 'Weak words'
    : packId === 'notebook' ? 'My flashcards'
    : getPack(packId).title;

  if (!deck.length) {
    return (
      <div className="h-full grid place-items-center px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-ink2">
            {packId === 'notebook'
              ? 'No custom cards yet — add words in your notebook and they become flashcards.'
              : packId === 'weak'
                ? 'No weak words — nothing here is tripping you up.'
                : 'Nothing due right now — nice work.'}
          </p>
          <button onClick={onBack} className="btn btn-secondary min-h-11 px-5 rounded-xl text-sm">Back to packs</button>
        </div>
      </div>
    );
  }

  const entry = deck[Math.min(index, deck.length - 1)];
  const cardSrs = srs[entry.id];
  void savedTick;
  const saved = isInNotebook(entry.id);

  const rate = (rating) => {
    rateCard(entry.id, rating);
    onRated();
    onActivity?.({ type: 'cards', rating });
    setTimeout(() => setIndex((i) => (i + 1) % deck.length), 250);
  };

  const toggleSave = () => {
    if (saved) removeFromNotebook(entry.id);
    else saveToNotebook({ id: entry.id, fr: entry.fr, en: entry.en, note: entry.note });
    setSavedTick((t) => t + 1);
    onSavedChange();
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to packs" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
            <p className="text-[11px] text-ink3 tabular-nums">
              Card {Math.min(index, deck.length - 1) + 1}/{deck.length}
              {cardSrs && ` · reviewed ×${cardSrs.reps}`}
            </p>
          </div>
          <button
            onClick={() => setIndex((i) => (i + 1) % deck.length)}
            aria-label="Next card"
            className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <VocabCard
          entry={entry}
          cardDue={isCardDue(cardSrs)}
          saved={saved}
          onRate={rate}
          onToggleSave={toggleSave}
          apiKey={apiKey}
          mockMode={mockMode}
        />
      </div>
    </div>
  );
}

function Notebook({ notebook, onBack, onChange }) {
  const [fr, setFr] = useState('');
  const [en, setEn] = useState('');

  const add = () => {
    if (!fr.trim() || !en.trim()) return;
    saveToNotebook({ id: `nb-${Date.now()}`, fr: fr.trim(), en: en.trim() });
    setFr('');
    setEn('');
    onChange();
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to packs" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 text-center">
            <h2 className="text-sm font-semibold text-ink">My notebook</h2>
            <p className="text-[11px] text-ink3">{notebook.length} saved word{notebook.length !== 1 ? 's' : ''}</p>
          </div>
          <span className="w-10" aria-hidden="true" />
        </div>

        {/* add your own word */}
        <div className="flex gap-2">
          <input
            value={fr}
            onChange={(e) => setFr(e.target.value)}
            placeholder="French word…"
            lang="fr"
            aria-label="French word"
            className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
          />
          <input
            value={en}
            onChange={(e) => setEn(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Meaning…"
            aria-label="English meaning"
            className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
          />
          <button onClick={add} disabled={!fr.trim() || !en.trim()} aria-label="Add word" className="btn btn-primary w-11 rounded-xl">
            <Plus size={16} />
          </button>
        </div>

        {notebook.length === 0 ? (
          <p className="text-xs text-ink3 text-center py-8">
            Tap “Save” on any vocabulary card — or add your own words above — and they'll live here.
          </p>
        ) : (
          <ul className="space-y-2">
            {notebook.map((e) => (
              <li key={e.id} className="flex items-center gap-3 bg-surface border border-line rounded-xl px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate" lang="fr">{e.fr}</p>
                  <p className="text-xs text-ink3 truncate">{e.en}{e.note ? ` · ${e.note}` : ''}</p>
                </div>
                <SpeakButton text={e.fr} label="Listen" />
                <button
                  onClick={() => { removeFromNotebook(e.id); onChange(); }}
                  aria-label={`Remove ${e.fr}`}
                  className="w-9 h-9 grid place-items-center rounded-full text-ink3 hover:text-ink hover:bg-surface2"
                >
                  <Trash size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
