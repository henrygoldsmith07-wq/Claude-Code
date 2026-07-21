import { useMemo, useState } from 'react';
import {
  CONJUGATIONS, PERSONS, TENSES, MINIMAL_PAIRS, CLOZE_TESTS, FREQUENCY_WORDS, parseWordList,
} from '../lib/reference';
import { allEntries } from '../lib/vocab';
import { getNotebook, saveToNotebook } from '../lib/storage';
import { speak, stopSpeaking } from '../lib/tts';
import { SpeakButton } from './ui';
import { X, ChevronLeft, ChevronRight, Check, Play, Book, Volume, FileText, Plus, Layers } from './icons';

// Reference & tools (full-screen): verb conjugation tables, a minimal-pairs
// ear drill, cloze tests, and an offline dictionary / frequency list with
// custom word-list import. All offline; TTS is on-device.

const TOOLS = [
  { id: 'conjugation', icon: Layers, title: 'Verb conjugations', blurb: 'Full tables for key verbs, with IPA' },
  { id: 'pairs', icon: Volume, title: 'Minimal pairs', blurb: 'Train your ear on tricky sound contrasts' },
  { id: 'cloze', icon: FileText, title: 'Cloze tests', blurb: 'Fill the gap — grammar in context' },
  { id: 'dict', icon: Book, title: 'Dictionary & frequency', blurb: 'Search words, see IPA, import your own' },
];

export default function Reference({ open, onClose, onImported }) {
  const [tool, setTool] = useState(null);

  if (!open) return null;

  const body = () => {
    if (tool === 'conjugation') return <Conjugations />;
    if (tool === 'pairs') return <MinimalPairs />;
    if (tool === 'cloze') return <Cloze />;
    if (tool === 'dict') return <Dictionary onImported={onImported} />;
    return (
      <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
        <div className="max-w-lg mx-auto space-y-4">
          <p className="text-xs text-ink2 text-center">Reference tables and drills — all offline.</p>
          <div className="space-y-2.5">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3.5 text-left hover:border-ink3 transition-colors"
              >
                <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-surface2 text-ink"><t.icon size={18} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink">{t.title}</span>
                  <span className="block text-xs text-ink3">{t.blurb}</span>
                </span>
                <ChevronRight size={16} className="text-ink3 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Reference and tools">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface shrink-0">
        {tool ? (
          <button onClick={() => { stopSpeaking(); setTool(null); }} aria-label="Back to tools" className="w-10 h-10 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
        ) : <span className="w-10" aria-hidden="true" />}
        <h2 className="flex-1 text-center text-sm font-semibold text-ink">
          {tool ? TOOLS.find((t) => t.id === tool).title : 'Reference & tools'}
        </h2>
        <button onClick={() => { stopSpeaking(); onClose(); }} aria-label="Close reference" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0">{body()}</div>
    </div>
  );
}

function Conjugations() {
  const [verb, setVerb] = useState(CONJUGATIONS[0]);
  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex flex-wrap gap-2">
          {CONJUGATIONS.map((v) => (
            <button
              key={v.inf}
              onClick={() => setVerb(v)}
              aria-pressed={verb.inf === v.inf}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${verb.inf === v.inf ? 'bg-accent text-onaccent border-accent' : 'bg-surface text-ink2 border-line hover:border-ink3'}`}
              lang="fr"
            >
              {v.inf}
            </button>
          ))}
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-ink" lang="fr">{verb.inf}</p>
            <p className="text-xs text-ink3">{verb.ipa} · {verb.en}</p>
          </div>
          <SpeakButton text={verb.inf} label="Listen" />
        </div>

        {TENSES.map((t) => (
          <div key={t.id} className="bg-surface border border-line rounded-2xl overflow-hidden">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 px-4 py-2.5 border-b border-line">{t.label}</h3>
            <ul>
              {verb.tenses[t.id].map((form, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2 border-b border-line last:border-0">
                  <span className="w-20 shrink-0 text-xs text-ink3">{PERSONS[i]}</span>
                  <span className="flex-1 text-sm text-ink" lang="fr">{form}</span>
                  <SpeakButton text={`${PERSONS[i].split('/')[0]} ${form}`} label="" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MinimalPairs() {
  const [idx, setIdx] = useState(0);
  const [target, setTarget] = useState(null); // 'a' | 'b' — which word was played
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const pair = MINIMAL_PAIRS[idx];

  const playRandom = () => {
    const which = Math.random() < 0.5 ? 'a' : 'b';
    setTarget(which);
    setPicked(null);
    stopSpeaking();
    speak(pair[which].fr, { rate: 0.95 });
  };

  const pick = (which) => {
    if (!target || picked) return;
    setPicked(which);
    setScore((s) => ({ right: s.right + (which === target ? 1 : 0), total: s.total + 1 }));
  };

  const next = () => {
    stopSpeaking();
    setIdx((i) => (i + 1) % MINIMAL_PAIRS.length);
    setTarget(null);
    setPicked(null);
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink3">Contrast: {pair.contrast}</p>

        <div className="bg-surface border border-line rounded-2xl p-6 space-y-3">
          <button onClick={playRandom} className="btn btn-primary min-h-11 px-5 rounded-xl text-sm">
            <Play size={13} /> {target ? 'Play again' : 'Play a word'}
          </button>
          <p className="text-[11px] text-ink3">{target ? 'Which word did you hear?' : 'Tap play, then choose which word you heard.'}</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {['a', 'b'].map((which) => {
            const w = pair[which];
            const isTarget = picked && which === target;
            const isWrongPick = picked && which === picked && which !== target;
            return (
              <button
                key={which}
                onClick={() => pick(which)}
                disabled={!target || Boolean(picked)}
                className={`rounded-2xl border p-4 text-center transition-colors ${isTarget ? 'bg-surface2 border-ink' : isWrongPick ? 'bg-surface border-line opacity-60' : 'bg-surface border-line hover:border-ink3'} disabled:cursor-default`}
              >
                <span className="block text-lg font-bold text-ink" lang="fr">{w.fr}</span>
                <span className="block text-[11px] text-ink3">{w.ipa}</span>
                <span className="block text-[11px] text-ink3">{w.en}</span>
                {isTarget && <Check size={15} className="mx-auto mt-1 text-ink" />}
              </button>
            );
          })}
        </div>

        {picked && (
          <div className="fade-in space-y-3">
            <p className="text-sm text-ink">{picked === target ? 'Correct — well heard.' : `Not quite — it was «${pair[target].fr}».`}</p>
            <div className="flex items-center justify-center gap-2">
              <SpeakButton text={pair.a.fr} label={pair.a.fr} />
              <SpeakButton text={pair.b.fr} label={pair.b.fr} />
            </div>
            <button onClick={next} className="btn btn-secondary min-h-11 px-5 rounded-xl text-sm">
              <ChevronRight size={14} /> Next pair
            </button>
          </div>
        )}

        {score.total > 0 && <p className="text-[11px] text-ink3 tabular-nums">Score: {score.right}/{score.total}</p>}
      </div>
    </div>
  );
}

function Cloze() {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const done = idx >= CLOZE_TESTS.length;
  const q = CLOZE_TESTS[idx];

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
  };
  const next = () => { setPicked(null); setIdx((i) => i + 1); };
  const restart = () => { setPicked(null); setIdx(0); setScore(0); };

  if (done) {
    return (
      <div className="h-full grid place-items-center px-4">
        <div className="text-center space-y-3">
          <p className="text-3xl font-bold text-ink tabular-nums">{score}/{CLOZE_TESTS.length}</p>
          <p className="text-sm text-ink2">{score === CLOZE_TESTS.length ? 'Perfect run.' : 'Review the explanations and go again.'}</p>
          <button onClick={restart} className="btn btn-primary min-h-11 px-5 rounded-xl text-sm">Start over</button>
        </div>
      </div>
    );
  }

  const filled = picked !== null
    ? q.text.replace('___', q.options[q.answer])
    : q.text;

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink3 text-center">Question {idx + 1} of {CLOZE_TESTS.length}</p>
        <div className="bg-surface border border-line rounded-2xl p-5 flex items-center gap-3">
          <p className="flex-1 text-[15px] text-ink font-medium leading-relaxed" lang="fr">{filled}</p>
          {picked !== null && <SpeakButton text={filled} label="Listen" />}
        </div>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answer;
            const isPicked = i === picked;
            let cls = 'bg-surface border-line hover:border-ink3';
            if (picked !== null) cls = isAnswer ? 'bg-surface2 border-ink' : 'bg-surface border-line opacity-60';
            return (
              <button key={i} onClick={() => pick(i)} disabled={picked !== null} className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-left text-sm text-ink transition-colors ${cls}`}>
                <span className="flex-1" lang="fr">{opt}</span>
                {picked !== null && isAnswer && <Check size={15} className="shrink-0" />}
                {picked !== null && isPicked && !isAnswer && <X size={15} className="shrink-0" />}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className="fade-in space-y-3">
            <div className="bg-surface2 border border-line rounded-xl px-3.5 py-2.5"><p className="text-xs text-ink2">{q.why}</p></div>
            <button onClick={next} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
              {idx + 1 < CLOZE_TESTS.length ? 'Next' : 'See score'} <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Dictionary({ onImported }) {
  const [query, setQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [raw, setRaw] = useState('');
  const [added, setAdded] = useState(null);

  // Merge the frequency list, the vocabulary library and saved notebook words
  // into one searchable offline dictionary.
  const dict = useMemo(() => {
    const vocab = allEntries().map((e) => ({ fr: e.fr, en: e.en, ipa: e.ipa || null, source: 'vocab' }));
    const freq = FREQUENCY_WORDS.map((w) => ({ ...w, source: 'freq' }));
    const nb = getNotebook().map((e) => ({ fr: e.fr, en: e.en, ipa: null, source: 'notebook' }));
    const seen = new Set();
    return [...freq, ...vocab, ...nb].filter((w) => {
      const k = w.fr.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [added]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? dict.filter((w) => w.fr.toLowerCase().includes(q) || w.en.toLowerCase().includes(q)) : dict;
    return list.slice(0, 60);
  }, [query, dict]);

  const doImport = () => {
    const words = parseWordList(raw);
    let n = 0;
    for (const w of words) {
      saveToNotebook({ id: `nb-${Date.now()}-${n}`, fr: w.fr, en: w.en });
      n += 1;
    }
    setAdded(n);
    setRaw('');
    setShowImport(false);
    onImported?.();
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search French or English…"
            aria-label="Search the dictionary"
            className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
          />
          <button onClick={() => setShowImport((v) => !v)} aria-label="Import a word list" className="btn btn-secondary min-h-11 px-3 rounded-xl">
            <Plus size={16} />
          </button>
        </div>

        {showImport && (
          <div className="fade-in bg-surface border border-line rounded-2xl p-4 space-y-2">
            <p className="text-[11px] text-ink3">Paste your own list — one per line, «French, English».</p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={4}
              placeholder={'le chien, the dog\nla voiture, the car'}
              aria-label="Custom word list"
              className="w-full bg-surface2 border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink resize-none"
            />
            <button onClick={doImport} disabled={!parseWordList(raw).length} className="btn btn-primary w-full min-h-10 rounded-xl text-xs">
              Add {parseWordList(raw).length || ''} to notebook
            </button>
          </div>
        )}
        {added != null && <p className="text-xs text-ink flex items-center gap-1.5" role="status"><Check size={13} /> Added {added} word{added !== 1 ? 's' : ''} to your notebook.</p>}

        <p className="text-[11px] text-ink3">{results.length} of {dict.length} entries</p>
        <ul className="space-y-2 cv-list">
          {results.map((w, i) => (
            <li key={`${w.fr}-${i}`} className="flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink" lang="fr">{w.fr}</p>
                <p className="text-xs text-ink3">
                  {w.ipa ? <span className="mr-1.5">{w.ipa}</span> : null}{w.en}
                  {w.rank ? <span className="ml-1.5 px-1 py-0.5 rounded bg-surface2 text-[10px] text-ink3">freq {w.rank}</span> : null}
                </p>
              </div>
              <SpeakButton text={w.fr.split(' / ')[0]} label="Listen" />
            </li>
          ))}
          {results.length === 0 && <p className="text-xs text-ink3 text-center py-6">No matches — try importing your own words above.</p>}
        </ul>
      </div>
    </div>
  );
}
