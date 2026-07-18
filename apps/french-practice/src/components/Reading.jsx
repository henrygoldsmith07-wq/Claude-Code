import { useMemo, useState } from 'react';
import { READING_KINDS, READING_TEXTS, getText } from '../lib/reading';
import { allEntries } from '../lib/vocab';
import { translateWord } from '../lib/groq';
import { getCachedWord, cacheWord, saveToNotebook, isInNotebook, recordSkillScore } from '../lib/storage';
import { SpeakButton, Spinner } from './ui';
import { BookOpen, ChevronLeft, ChevronRight, Check, X, RefreshCw, Bookmark, BookmarkFilled } from './icons';

// Reading hub: graded readers, a branching interactive story, articles,
// news and public-domain classics — with dual-language display, per-word
// tap-to-translate (gloss → shared dictionary → cached LLM lookup) and
// comprehension quizzes.

const normalizeWord = (w) =>
  w.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '').trim();

// Shared dictionary assembled from the vocabulary library.
const VOCAB_DICT = (() => {
  const dict = {};
  for (const e of allEntries()) {
    const key = normalizeWord(e.fr.replace(/^(le|la|les|l'|un|une|des)\s+/i, ''));
    if (key && !dict[key]) dict[key] = e.en;
  }
  return dict;
})();

export default function Reading({ apiKey, mockMode, onXp }) {
  const [textId, setTextId] = useState(null);
  const text = textId ? getText(textId) : null;

  if (text) {
    return text.kind === 'story'
      ? <StoryReader key={text.id} text={text} apiKey={apiKey} mockMode={mockMode} onBack={() => setTextId(null)} />
      : <TextReader key={text.id} text={text} apiKey={apiKey} mockMode={mockMode} onXp={onXp} onBack={() => setTextId(null)} />;
  }

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-ink">Reading</h2>
          <p className="text-xs text-ink2 mt-1">
            Tap any word to translate it and save it to your notebook.
          </p>
        </div>
        {READING_KINDS.map((kind) => (
          <section key={kind.id}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 mb-2">
              {kind.title} <span className="normal-case font-normal text-ink3">— {kind.description}</span>
            </h3>
            <div className="space-y-2">
              {READING_TEXTS.filter((t) => t.kind === kind.id).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTextId(t.id)}
                  className="w-full flex items-center gap-3.5 bg-surface border border-line rounded-2xl px-4 py-3 text-left hover:border-ink3 transition-colors"
                >
                  <span className="w-9 h-9 shrink-0 grid place-items-center rounded-lg bg-surface2 text-ink"><BookOpen size={15} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink truncate" lang="fr">{t.title}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md border border-line text-[10px] font-semibold text-ink3">{t.cefr}</span>
                    </span>
                    <span className="block text-xs text-ink3 truncate">{t.description}</span>
                  </span>
                  <ChevronRight size={16} className="text-ink3 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Shell({ title, onBack, children }) {
  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4 pb-24">
        <div className="flex items-center gap-2">
          <button onClick={onBack} aria-label="Back to reading" className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-surface2 text-ink2 hover:bg-line">
            <ChevronLeft size={18} />
          </button>
          <h2 className="flex-1 text-center text-sm font-semibold text-ink truncate" lang="fr">{title}</h2>
          <span className="w-10" aria-hidden="true" />
        </div>
        {children}
      </div>
    </div>
  );
}

// One paragraph rendered word-by-word so every word is tappable.
function TappableParagraph({ fr, en, showEnglish, onWord }) {
  return (
    <div>
      <p className="text-[15px] text-ink leading-relaxed whitespace-pre-line" lang="fr">
        {fr.split(/(\s+)/).map((chunk, i) =>
          /\s/.test(chunk) || !normalizeWord(chunk) ? (
            chunk
          ) : (
            <button
              key={i}
              onClick={() => onWord(chunk, fr)}
              className="rounded hover:bg-surface2 focus-visible:bg-surface2 focus:outline-none"
            >
              {chunk}
            </button>
          )
        )}
      </p>
      {showEnglish && <p className="text-xs text-ink3 italic mt-1.5 whitespace-pre-line">{en}</p>}
    </div>
  );
}

// Bottom popover for a tapped word: gloss → vocab dict → cached LLM lookup.
function WordPopover({ lookup, onClose }) {
  const { word, translation, loading } = lookup;
  const saved = isInNotebook(`nb-word-${normalizeWord(word)}`);
  const [savedTick, setSavedTick] = useState(0);
  void savedTick;

  return (
    <div className="fixed left-0 right-0 bottom-16 z-40 px-4 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto fade-in bg-surface border border-line rounded-2xl shadow-xl shadow-black/20 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink" lang="fr">{word}</p>
          {loading
            ? <Spinner label="Looking up…" />
            : <p className="text-xs text-ink2 truncate">{translation || 'No translation found'}</p>}
        </div>
        <SpeakButton text={word} label="Listen" />
        {!loading && translation && (
          <button
            onClick={() => {
              if (!saved) {
                saveToNotebook({ id: `nb-word-${normalizeWord(word)}`, fr: word, en: translation, note: 'from reading' });
                setSavedTick((t) => t + 1);
              }
            }}
            aria-label={saved ? 'Saved to notebook' : 'Save to notebook'}
            className={`inline-flex items-center gap-1 px-2 py-1 min-h-8 rounded-lg text-[11px] font-medium ${
              saved ? 'bg-accent text-onaccent' : 'bg-surface2 text-ink2 hover:bg-line'
            }`}
          >
            {saved ? <BookmarkFilled size={12} /> : <Bookmark size={12} />} {saved ? 'Saved' : 'Save'}
          </button>
        )}
        <button onClick={onClose} aria-label="Close translation" className="w-8 h-8 grid place-items-center rounded-full text-ink3 hover:bg-surface2">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function useWordLookup(text, apiKey, mockMode) {
  const [lookup, setLookup] = useState(null); // { word, translation, loading }

  const gloss = useMemo(() => {
    const g = {};
    for (const [k, v] of Object.entries(text.gloss || {})) g[normalizeWord(k)] = v;
    return g;
  }, [text]);

  const onWord = async (raw, sentence) => {
    const word = raw.replace(/[«»".,;:!?()]/g, '').trim();
    const key = normalizeWord(word);
    if (!key) return;
    const local = gloss[key] || VOCAB_DICT[key] || getCachedWord(key);
    if (local) {
      setLookup({ word, translation: local, loading: false });
      return;
    }
    setLookup({ word, translation: '', loading: true });
    try {
      const t = await translateWord(apiKey, { word, context: sentence, mock: mockMode });
      if (t) cacheWord(key, t);
      setLookup({ word, translation: t, loading: false });
    } catch (e) {
      setLookup({ word, translation: `Lookup failed: ${e.message}`, loading: false });
    }
  };

  return { lookup, onWord, close: () => setLookup(null) };
}

function TextReader({ text, apiKey, mockMode, onXp, onBack }) {
  const [showEnglish, setShowEnglish] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const { lookup, onWord, close } = useWordLookup(text, apiKey, mockMode);

  const answer = (i) => {
    if (quiz.picked != null) return;
    setQuiz({ ...quiz, picked: i, correct: quiz.correct + (i === text.questions[quiz.index].answer ? 1 : 0) });
  };
  const nextQuestion = () => {
    if (quiz.index + 1 < text.questions.length) setQuiz({ ...quiz, index: quiz.index + 1, picked: null });
    else {
      const gained = Math.max(1, quiz.correct * 5);
      onXp(gained);
      recordSkillScore('reading', Math.round((quiz.correct / text.questions.length) * 100));
      setQuiz({ ...quiz, done: true, gained });
    }
  };

  return (
    <Shell title={text.title} onBack={onBack}>
      <div className="flex items-center justify-between">
        <span className="px-1.5 py-0.5 rounded-md border border-line text-[10px] font-semibold text-ink3">{text.cefr}</span>
        <button
          onClick={() => setShowEnglish((v) => !v)}
          className="text-[11px] font-semibold text-ink2 hover:text-ink min-h-8"
        >
          {showEnglish ? 'Hide English' : 'Dual-language'}
        </button>
      </div>

      <article className="bg-surface border border-line rounded-2xl p-5 space-y-4">
        {text.paragraphs.map((p, i) => (
          <TappableParagraph key={i} fr={p.fr} en={p.en} showEnglish={showEnglish} onWord={onWord} />
        ))}
      </article>

      {text.questions && (
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Comprehension check</h3>
          {!quiz ? (
            <button
              onClick={() => setQuiz({ index: 0, correct: 0, picked: null, done: false })}
              className="btn btn-primary w-full min-h-11 rounded-xl text-sm"
            >
              Start the quiz
            </button>
          ) : quiz.done ? (
            <div className="text-center space-y-2 fade-in">
              <p className="text-2xl font-bold text-ink tabular-nums">{quiz.correct}/{text.questions.length}</p>
              <p className="text-xs text-ink2">
                {quiz.correct === text.questions.length ? 'Perfect comprehension.' : 'Reread and try again.'} +{quiz.gained} XP
              </p>
              <button
                onClick={() => setQuiz({ index: 0, correct: 0, picked: null, done: false })}
                className="btn btn-secondary min-h-10 px-4 rounded-xl text-xs"
              >
                <RefreshCw size={12} /> Retake
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-ink3 tabular-nums">Question {quiz.index + 1}/{text.questions.length}</p>
              <p className="text-sm text-ink">{text.questions[quiz.index].q}</p>
              {text.questions[quiz.index].options.map((opt, i) => {
                const isAnswer = i === text.questions[quiz.index].answer;
                let cls = 'border-line bg-surface text-ink2 hover:border-ink3';
                if (quiz.picked != null && isAnswer) cls = 'border-ink bg-surface2 text-ink font-semibold';
                else if (quiz.picked === i) cls = 'border-line text-ink3 line-through';
                return (
                  <button key={i} onClick={() => answer(i)} disabled={quiz.picked != null}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${cls}`}>
                    <span className="inline-flex items-center gap-2">
                      {quiz.picked != null && isAnswer && <Check size={13} />}
                      {quiz.picked === i && !isAnswer && <X size={13} />}
                      {opt}
                    </span>
                  </button>
                );
              })}
              {quiz.picked != null && (
                <button onClick={nextQuestion} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                  {quiz.index + 1 < text.questions.length ? 'Next question' : 'See my score'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {lookup && <WordPopover lookup={lookup} onClose={close} />}
    </Shell>
  );
}

function StoryReader({ text, apiKey, mockMode, onBack }) {
  const [nodeId, setNodeId] = useState(text.start);
  const [showEnglish, setShowEnglish] = useState(false);
  const { lookup, onWord, close } = useWordLookup(text, apiKey, mockMode);
  const node = text.nodes[nodeId];

  return (
    <Shell title={text.title} onBack={onBack}>
      <div className="flex items-center justify-between">
        <span className="px-1.5 py-0.5 rounded-md border border-line text-[10px] font-semibold text-ink3">{text.cefr}</span>
        <button onClick={() => setShowEnglish((v) => !v)} className="text-[11px] font-semibold text-ink2 hover:text-ink min-h-8">
          {showEnglish ? 'Hide English' : 'Dual-language'}
        </button>
      </div>

      <article className="bg-surface border border-line rounded-2xl p-5 space-y-4 fade-in" key={nodeId}>
        {node.paragraphs.map((p, i) => (
          <TappableParagraph key={i} fr={p.fr} en={p.en} showEnglish={showEnglish} onWord={onWord} />
        ))}
        {node.ending && (
          <p className="text-xs text-ink3 italic border-t border-line pt-3" lang="fr">{node.ending}</p>
        )}
      </article>

      {node.choices?.length ? (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">What do you do?</h3>
          {node.choices.map((c, i) => (
            <button
              key={i}
              onClick={() => setNodeId(c.next)}
              className="w-full text-left px-4 py-3 rounded-xl border border-line bg-surface text-sm text-ink hover:border-ink3 transition-colors"
              lang="fr"
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setNodeId(text.start)}
          className="btn btn-secondary w-full min-h-11 rounded-xl text-sm"
        >
          <RefreshCw size={13} /> Read again, choose differently
        </button>
      )}

      {lookup && <WordPopover lookup={lookup} onClose={close} />}
    </Shell>
  );
}
