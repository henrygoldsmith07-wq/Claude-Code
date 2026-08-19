import { useMemo, useState } from 'react';
import { langName } from '../lib/i18n';
import { getVocabPacks, getPack, allEntries, groupedPacks } from '../lib/vocab';
import {
  getSrs, rateCard, isCardDue,
  getNotebook, isInNotebook, saveToNotebook, removeFromNotebook,
} from '../lib/storage';
import VocabCard from './VocabCard';
import VocabQuiz from './VocabQuiz';
import Memory from './Memory';
import { weakEntries, notebookAsEntries, reviewOrder, dueEntries, frontierTier, isEntryDue } from '../lib/memory';
import { fsrsRetention, isProductiveUnlocked } from '../lib/fsrs';
import { activeVocabTarget, controlledNewVocab } from '../lib/adaptivePractice';
import { SpeakButton } from './ui';
import { ChevronLeft, ChevronRight, Layers, Book, Plus, Trash, BarChart, Clock, Search, Target } from './icons';

// Vocabulary hub: themed packs, a cross-pack SRS review queue, the personal
// notebook of saved/custom words, and the memory & revision dashboard.

// Accent-insensitive match so «cafe» finds the «Food & Café» pack.
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const SORTS = [['default', 'Default'], ['az', 'A–Z'], ['size', 'Most words'], ['due', 'Due first']];

export default function Vocabulary({ apiKey, mockMode, onActivity, onXp }) {
  const [view, setView] = useState({ mode: 'packs' }); // packs | deck | notebook | memory
  const [srsTick, setSrsTick] = useState(0);
  const [nbTick, setNbTick] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [openCats, setOpenCats] = useState(() => new Set(['essentials'])); // expanded categories
  const toggleCat = (id) => setOpenCats((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const srs = useMemo(() => getSrs(), [srsTick]);
  const notebook = useMemo(() => getNotebook(), [nbTick]);

  // New cards are introduced by frequency, so the "due" set is gated to the
  // current frontier tier (computed once, globally, over the whole library).
  const frontier = useMemo(() => frontierTier(allEntries(), srs), [srs]);
  const dueTotal = [...allEntries(), ...notebookAsEntries(notebook)]
    .filter((e) => isEntryDue(e, srs, frontier)).length;

  // Per-pack due counts (drive the badge and the "Due first" sort).
  const dueByPack = useMemo(() => {
    const m = {};
    for (const p of getVocabPacks()) m[p.id] = p.entries.filter((e) => isEntryDue(e, srs, frontier)).length;
    return m;
  }, [srs, frontier]);

  // Search matches a pack by name, description, or any word it contains, so a
  // learner can find "the pack with fromage" without knowing its title.
  const visiblePacks = useMemo(() => {
    const q = norm(query.trim());
    let list = getVocabPacks();
    if (q.length >= 2) {
      list = list.filter((p) =>
        norm(`${p.title} ${p.description}`).includes(q) ||
        p.entries.some((e) => norm(`${e.fr} ${e.en}`).includes(q)),
      );
    }
    const by = {
      default: () => list,
      az: () => [...list].sort((a, b) => a.title.localeCompare(b.title)),
      size: () => [...list].sort((a, b) => b.entries.length - a.entries.length),
      due: () => [...list].sort((a, b) => (dueByPack[b.id] || 0) - (dueByPack[a.id] || 0)),
    };
    return by[sort]();
  }, [query, sort, dueByPack]);

  // Group into categories only in the neutral view — searching or sorting
  // flattens to a single ranked grid so results aren't split across sections.
  const grouped = sort === 'default' && norm(query.trim()).length < 2;

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
        onXp={onXp}
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
              <span className="block text-xs opacity-70">Interleaved across packs — most-used words first</span>
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

        {/* find a pack: search across titles, blurbs and the words inside */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-3">
            <Search size={15} className="text-ink3 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search packs & words…"
              aria-label="Search vocabulary packs"
              className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-ink3 focus:outline-none py-2.5"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto snap-rail -mx-1 px-1" role="tablist" aria-label="Sort packs">
              {SORTS.map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={sort === id}
                  onClick={() => setSort(id)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                    sort === id ? 'bg-accent text-onaccent border-accent' : 'bg-surface text-ink2 border-line hover:border-ink3'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="shrink-0 text-[11px] text-ink3 tabular-nums">{visiblePacks.length}/{getVocabPacks().length}</span>
          </div>
        </div>

        {/* themed packs — grouped by category in the default view, a flat
            filtered grid while searching or when a sort is applied */}
        {visiblePacks.length === 0 ? (
          <div className="text-center py-10 space-y-1">
            <p className="text-sm text-ink2">No packs match «{query.trim()}».</p>
            <button onClick={() => setQuery('')} className="text-xs text-ink3 underline hover:text-ink">Clear search</button>
          </div>
        ) : grouped ? (
          <div className="space-y-2.5">
            {groupedPacks().map((g) => {
              const open = openCats.has(g.id);
              const dueInCat = g.packs.reduce((n, p) => n + (dueByPack[p.id] || 0), 0);
              const words = g.packs.reduce((n, p) => n + p.entries.length, 0);
              return (
                <section key={g.id} className="bg-surface border border-line rounded-2xl overflow-hidden">
                  <button
                    onClick={() => toggleCat(g.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface2 transition-colors"
                  >
                    <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><Layers size={16} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink">{g.label}</span>
                      <span className="block text-[11px] text-ink3">{g.packs.length} pack{g.packs.length > 1 ? 's' : ''} · {words} words</span>
                    </span>
                    {dueInCat > 0 && (
                      <span className="shrink-0 min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-surface2 text-ink2 text-[10px] font-semibold tabular-nums">{dueInCat}</span>
                    )}
                    <ChevronRight size={16} className={`text-ink3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                  </button>
                  {open && (
                    <div className="px-3 pb-3 pt-0.5 grid grid-cols-2 gap-2.5 cv-list fade-in">
                      {g.packs.map((p) => (
                        <PackCard key={p.id} pack={p} due={dueByPack[p.id] || 0} onOpen={() => setView({ mode: 'deck', packId: p.id })} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 cv-list">
            {visiblePacks.map((p) => (
              <PackCard key={p.id} pack={p} due={dueByPack[p.id] || 0} onOpen={() => setView({ mode: 'deck', packId: p.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// One vocabulary pack tile, with its due-count badge and word count.
function PackCard({ pack, due, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="relative bg-surface border border-line rounded-2xl p-4 text-left hover:border-ink3 transition-colors"
    >
      {due > 0 && (
        <span className="absolute top-3 right-3 min-w-5 h-5 px-1 grid place-items-center rounded-full bg-surface2 text-ink2 text-[10px] font-semibold tabular-nums">
          {due}
        </span>
      )}
      <Layers size={16} className="text-ink2 mb-2" />
      <span className="block text-sm font-semibold text-ink">{pack.title}</span>
      <span className="block text-[11px] text-ink3 mt-0.5 leading-snug">{pack.description}</span>
      <span className="block text-[10px] text-ink3 mt-1.5">{pack.entries.length} words</span>
    </button>
  );
}

function Deck({ packId, onBack, srs, onRated, onSavedChange, apiKey, mockMode, onActivity, onXp }) {
  const [index, setIndex] = useState(0);
  const [savedTick, setSavedTick] = useState(0);
  const [study, setStudy] = useState('cards'); // cards | quiz
  const [cardMode, setCardMode] = useState('receptive'); // receptive | productive — FSRS dual-mastery

  // Virtual packs: 'review' = every due card (packs + notebook), 'weak' =
  // high-lapse stumblers, 'notebook' = the learner's custom flashcards.
  const deck = useMemo(() => {
    const initial = getSrs();
    const library = () => [...allEntries(), ...notebookAsEntries(getNotebook())];
    if (packId === 'review') {
      // Due set is frequency-gated (most common first), then ordered so the
      // words closest to being forgotten come up first within that.
      return reviewOrder(dueEntries(library(), initial), initial);
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

  if (study === 'quiz') {
    return (
      <VocabQuiz
        deck={deck}
        library={[...allEntries(), ...notebookAsEntries(getNotebook())]}
        title={title}
        onRate={onRated}
        onXp={onXp}
        onActivity={onActivity}
        onBack={() => setStudy('cards')}
        cardMode={cardMode}
      />
    );
  }

  const entry = deck[Math.min(index, deck.length - 1)];
  const receptiveKey = entry.id;
  const productiveKey = `${entry.id}::productive`;
  const cardSrs = cardMode === 'productive' ? (srs[productiveKey] || null) : srs[receptiveKey];
  void savedTick;
  const saved = isInNotebook(entry.id);
  const productiveReady = isProductiveUnlocked(srs, entry.id);
  const retention = cardSrs ? fsrsRetention(cardSrs) : null;

  const rate = (rating) => {
    rateCard(entry.id, rating, { mode: cardMode, label: entry.fr, skill: 'vocabulary' });
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

        {/* study-mode toggle: passive flip cards vs. active-recall quiz */}
        <div className="flex gap-1 p-1 bg-surface2 rounded-full" role="tablist" aria-label="Study mode">
          <button
            role="tab"
            aria-selected="true"
            className="flex-1 py-1.5 rounded-full text-xs font-semibold bg-surface text-ink shadow-sm"
          >
            Flashcards
          </button>
          <button
            role="tab"
            aria-selected="false"
            onClick={() => setStudy('quiz')}
            className="flex-1 py-1.5 rounded-full text-xs font-semibold text-ink2 hover:text-ink inline-flex items-center justify-center gap-1"
          >
            <Target size={12} /> Quiz
          </button>
        </div>
        <div className="flex gap-1 p-1 bg-surface border border-line rounded-full" role="tablist" aria-label="Card direction">
          {['receptive','productive'].map(m=> (
            <button key={m} role="tab" aria-selected={cardMode===m} disabled={m==='productive' && !productiveReady}
              onClick={()=> setCardMode(m)}
              title={m==='productive' && !productiveReady ? 'Unlocks after 2 successful receptive reviews' : undefined}
              className={`flex-1 py-1 rounded-full text-[11px] font-semibold ${cardMode===m ? 'bg-ink text-bg' : 'text-ink3'} ${m==='productive' && !productiveReady ? 'opacity-40' : ''}`}>
              {m==='receptive' ? 'FR→EN' : 'EN→FR'}
            </button>
          ))}
        </div>
        {retention!=null && (
          <p className="text-[11px] text-ink3 text-center">Predicted recall: {Math.round(retention*100)}% · {cardMode} · {cardSrs.D!=null ? `D${cardSrs.D} S${cardSrs.S}d` : `ease ${cardSrs.ease}`}</p>
        )}
        {cardMode==='productive' && !productiveReady && (
          <p className="text-[11px] text-ink3 text-center">Produce mode unlocks after 2 good receptive reviews.</p>
        )}

        <VocabCard
          key={`${entry.id}::${cardMode}`}
          entry={cardMode==='productive' ? { ...entry, fr: entry.en, en: entry.fr } : entry}
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
            placeholder={`${langName()} word…`}
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
