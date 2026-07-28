import { useState } from 'react';
import { Check, Info, ReceiptText, TriangleAlert } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { parseReceipt } from '../lib/receipt.js';
import { gbp } from '../lib/utils.js';
import { Card, Pill } from './ui.jsx';

const SAMPLE = `TESCO EXTRA
28/07/2026  14:02

BANANAS LOOSE          £0.83
2 x @ £1.25
SEMI SKIMMED MILK 2L   £2.50
CHICKEN BREAST 650G    £5.49
0.482 kg @ £4.99/kg
BROCCOLI               £2.41
WHOLEMEAL BREAD        £1.15
CLUBCARD SAVING       -£0.50

TOTAL                 £12.38
VISA CONTACTLESS      £12.38`;

/**
 * Reading a receipt you paste in.
 *
 * There's no OCR here, so the photo isn't the input — the text is, from your
 * retailer's app or an emailed receipt. What the app does do is the actual
 * work: parse the lines, and then check its own total against the printed one,
 * which is the only way you'd know whether to trust the parse.
 */
export default function ReceiptScan({ onDone }) {
  const app = useApp();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  const read = () => setResult(parseReceipt(text));

  const addToPantry = () => {
    for (const item of result.items) {
      app.addPantryItem({ name: item.name, cat: 'Fresh', location: 'Cupboard', cost: item.price, store: result.store, qty: item.qty > 1 ? `${item.qty}` : '' });
    }
    onDone?.();
  };

  return (
    <div className="px-5 pb-10 space-y-4">
      <Card className="space-y-3">
        <p className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
          Forq ships no OCR, so it doesn’t pretend to read the photograph — that would be a
          demonstration, not a feature. Paste the text instead, from your shop’s app or an emailed
          receipt, and the parsing is the part that’s real.
        </p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); }}
          rows={7}
          placeholder="Paste the receipt"
          aria-label="Receipt text"
          className="w-full rounded-2xl border px-3 py-2.5 text-[12px] font-mono outline-none"
          style={{ background: 'var(--card-2)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setText(SAMPLE)}
            className="press rounded-2xl border px-3 py-2 text-[12.5px] font-extrabold"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            Example
          </button>
          <button
            onClick={read}
            disabled={!text.trim()}
            className="press flex-1 rounded-2xl border py-2 text-[13px] font-extrabold disabled:opacity-40"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            <span className="inline-flex items-center gap-1.5"><ReceiptText size={14} /> Read it</span>
          </button>
        </div>
        {result?.error && <p className="text-[12.5px] font-semibold" style={{ color: 'var(--danger)' }}>{result.error}</p>}
      </Card>

      {result?.items?.length > 0 && (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <p className="font-bold text-[14px]">
                {result.items.length} item{result.items.length === 1 ? '' : 's'}
                {result.store && ` · ${result.store}`}
              </p>
              {result.balanced === true && <Pill tone="good"><Check size={11} /> Adds up</Pill>}
              {result.balanced === false && <Pill tone="warn"><TriangleAlert size={11} /> Check it</Pill>}
            </div>
            {result.printedTotal !== null && (
              <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                Items come to {gbp(result.itemTotal, { always: true })}; the receipt says{' '}
                {gbp(result.printedTotal, { always: true })}.
                {result.balanced ? ' That matches, so the parse is sound.' : ' They differ — something was misread, so check before you keep it.'}
              </p>
            )}
            <div className="mt-2 divide-y" style={{ borderColor: 'var(--line)' }}>
              {result.items.map((item, i) => (
                <div key={`${item.name}-${i}`} className="flex items-center justify-between py-1.5">
                  <span className="text-[13px] font-semibold truncate">{item.qty > 1 ? `${item.qty} × ` : ''}{item.name}</span>
                  <span className="text-[13px] font-bold shrink-0">{gbp(item.price, { always: true })}</span>
                </div>
              ))}
            </div>
          </Card>

          {result.unread.length > 0 && (
            <Card className="!p-3">
              <p className="text-[12px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--faint)' }}>
                Couldn’t read {result.unread.length} line{result.unread.length === 1 ? '' : 's'}
              </p>
              {result.unread.slice(0, 5).map((line, i) => (
                <p key={`${line}-${i}`} className="text-[12px] font-mono" style={{ color: 'var(--muted)' }}>{line}</p>
              ))}
              <p className="mt-1 text-[12px] font-semibold inline-flex items-start gap-1.5" style={{ color: 'var(--muted)' }}>
                <Info size={13} className="mt-0.5 shrink-0" /> Listed rather than dropped, so you can
                see exactly what didn’t make it in.
              </p>
            </Card>
          )}

          <button
            onClick={addToPantry}
            className="press w-full rounded-2xl py-3 text-[14px] font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Add {result.items.length} to the pantry
          </button>
        </>
      )}
    </div>
  );
}
