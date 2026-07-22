import { useEffect, useRef, useState } from 'react';
import { READING_TEXTS } from '../lib/reading';
import { LISTENING_TRACKS } from '../lib/listening';
import { exportProgress, importProgress, getSyncId, getLastBackup, getSettings } from '../lib/storage';
import { makeSyncCode, restoreSyncCode } from '../lib/account';
import { X, Check, Download, Upload, BookOpen, Volume, RefreshCw, Copy, Key } from './icons';

// Offline features: the app is a client-side PWA, so once the service worker
// has cached it, every lesson works with no network and TTS audio is
// generated on-device. This panel surfaces offline readiness, lets you save
// stories/podcasts as text files, and moves progress between devices via a
// backup file (there is no backend to sync through).

function downloadFile(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const readingText = (t) =>
  `${t.title}\n${'='.repeat(t.title.length)}\n\n` +
  (t.paragraphs || []).map((p) => `${p.fr}\n(${p.en})`).join('\n\n') + '\n';

const trackText = (t) =>
  `${t.title}\n${'='.repeat(t.title.length)}\n\n` +
  (t.lines || []).map((l) => `${l.fr}\n(${l.en})`).join('\n\n') + '\n';

export default function Offline({ open, onClose, pwa }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [cacheCount, setCacheCount] = useState(null); // null = unknown, number = files cached
  const [restored, setRestored] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  // account & sync-code state
  const [passphrase, setPassphrase] = useState('');
  const [code, setCode] = useState('');
  const [pasteCode, setPasteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    // Ask the service worker how many assets it has cached.
    const sw = navigator.serviceWorker;
    let handler;
    if (sw && sw.controller) {
      handler = (e) => { if (e.data?.type === 'cache-count') setCacheCount(e.data.count); };
      sw.addEventListener('message', handler);
      sw.controller.postMessage('cache-count');
    } else {
      setCacheCount(0);
    }
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      if (handler && sw) sw.removeEventListener('message', handler);
    };
  }, [open]);

  if (!open) return null;

  const ready = cacheCount != null && cacheCount > 0;

  const doExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`le-studio-backup-${stamp}.json`, JSON.stringify(exportProgress(), null, 2), 'application/json');
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setRestored(null);
    try {
      const n = importProgress(JSON.parse(await file.text()));
      setRestored(n);
    } catch (err) {
      setError(err.message);
    }
  };

  // Generate a sync code from the current progress (encrypted if a passphrase
  // is set) and copy it to the clipboard.
  const genCode = async () => {
    setError(null); setCopied(false); setBusy(true);
    try {
      const c = await makeSyncCode(passphrase);
      setCode(c);
      try { await navigator.clipboard.writeText(c); setCopied(true); } catch { /* manual copy */ }
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const restoreFromCode = async () => {
    setError(null); setRestored(null); setBusy(true);
    try {
      const n = await restoreSyncCode(pasteCode, passphrase);
      setRestored(n);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const account = getSettings().name?.trim();
  const lastBackup = getLastBackup();
  const stories = READING_TEXTS.filter((t) => Array.isArray(t.paragraphs) && t.paragraphs.length);

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Offline">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface shrink-0">
        <h2 className="flex-1 text-sm font-semibold text-ink">Offline & devices</h2>
        <button onClick={onClose} aria-label="Close offline" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll px-4 py-5">
        <div className="max-w-md mx-auto space-y-6">
          {/* install */}
          <section className="bg-surface border border-line rounded-2xl p-5 space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 inline-flex items-center gap-1.5"><Download size={12} /> Install the app</h3>
            {pwa?.installed ? (
              <p className="text-xs text-ink2 inline-flex items-center gap-1.5"><Check size={13} /> Installed — you’re running the app from your home screen.</p>
            ) : pwa?.canInstall ? (
              <>
                <p className="text-xs text-ink3 leading-relaxed">Add Le Studio to your device for a full-screen, app-like experience that opens straight from your home screen and works offline.</p>
                <button onClick={() => pwa.promptInstall()} className="btn btn-primary w-full min-h-11 rounded-xl text-sm"><Download size={14} /> Install Le Studio</button>
              </>
            ) : pwa?.iosInstall ? (
              <p className="text-xs text-ink3 leading-relaxed">
                On iPhone/iPad: tap the <span className="font-semibold text-ink">Share</span> button in Safari, then
                <span className="font-semibold text-ink"> “Add to Home Screen”</span> to install Le Studio.
              </p>
            ) : (
              <p className="text-xs text-ink3 leading-relaxed">
                Le Studio is an installable web app. Your browser will offer an <span className="font-semibold text-ink">Install</span> option
                (often in the address bar or the ⋮ menu) — or check back here once it’s ready.
              </p>
            )}
          </section>

          {/* status */}
          <section className="bg-surface border border-line rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-ink' : 'bg-ink3'}`} aria-hidden="true" />
              <span className="text-sm font-semibold text-ink">{online ? 'Online' : 'Offline'}</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink2">
                {ready ? <><Check size={13} /> Ready offline</> : 'Caching…'}
              </span>
            </div>
            <p className="text-xs text-ink3 leading-relaxed">
              Le Studio is a fully client-side app. Once loaded it installs a service worker, so
              every lesson, story and drill works with no connection{ready ? ` (${cacheCount} files cached)` : ''}.
              Spoken audio is generated on your device, so listening and pronunciation work offline too.
              Only the AI conversation and correction features need the network (they call Groq live).
            </p>
          </section>

          {/* download stories */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 inline-flex items-center gap-1.5"><BookOpen size={12} /> Download stories</h3>
            <p className="text-[11px] text-ink3 -mt-1">Save the text (with translations) to read anywhere.</p>
            <div className="space-y-2">
              {stories.map((t) => (
                <div key={t.id} className="flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-ink truncate" lang="fr">{t.title}</span>
                    <span className="block text-xs text-ink3">{t.cefr} · {t.description}</span>
                  </span>
                  <button
                    onClick={() => downloadFile(`${t.id}.txt`, readingText(t))}
                    aria-label={`Download ${t.title}`}
                    className="btn btn-secondary min-h-9 px-3 rounded-lg text-xs shrink-0"
                  >
                    <Download size={13} /> Save
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* download podcasts */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 inline-flex items-center gap-1.5"><Volume size={12} /> Download podcasts</h3>
            <p className="text-[11px] text-ink3 -mt-1">Transcripts for the narrated tracks — play the audio in-app (on-device TTS).</p>
            <div className="space-y-2">
              {LISTENING_TRACKS.map((t) => (
                <div key={t.id} className="flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-ink truncate" lang="fr">{t.title}</span>
                    <span className="block text-xs text-ink3">{t.cefr} · {t.description}</span>
                  </span>
                  <button
                    onClick={() => downloadFile(`${t.id}.txt`, trackText(t))}
                    aria-label={`Download ${t.title}`}
                    className="btn btn-secondary min-h-9 px-3 rounded-lg text-xs shrink-0"
                  >
                    <Download size={13} /> Save
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* account & sync across devices */}
          <section className="bg-surface border border-line rounded-2xl p-5 space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 inline-flex items-center gap-1.5"><RefreshCw size={12} /> Account & sync</h3>

            {/* local account identity */}
            <div className="flex items-center gap-3 bg-surface2 rounded-xl px-3.5 py-2.5">
              <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-surface text-ink border border-line"><Key size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{account || 'Guest profile'}</p>
                <p className="text-[11px] text-ink3 truncate">Sync ID {getSyncId()}{lastBackup ? ` · backed up ${new Date(lastBackup).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</p>
              </div>
            </div>

            <p className="text-xs text-ink3 leading-relaxed">
              There’s no server — your data stays on this device. To move it, create a <span className="font-semibold text-ink">sync code</span> here and paste it on another device. Add a passphrase to encrypt it so it’s safe to send to yourself. Your API key is never included.
            </p>

            {/* optional passphrase */}
            <label className="block">
              <span className="text-[11px] font-semibold text-ink2">Passphrase (optional — encrypts the code)</span>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Leave blank for an unencrypted code"
                aria-label="Sync passphrase"
                className="mt-1 w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
              />
            </label>

            {/* create / copy code */}
            <div className="space-y-2">
              <button onClick={genCode} disabled={busy} className="btn btn-primary w-full min-h-11 rounded-xl text-sm">
                <RefreshCw size={14} /> {busy ? 'Working…' : 'Create sync code'}
              </button>
              {code && (
                <div className="space-y-1.5">
                  <textarea
                    readOnly
                    value={code}
                    onFocus={(e) => e.target.select()}
                    rows={3}
                    aria-label="Your sync code"
                    className="w-full bg-surface2 border border-line rounded-xl px-3 py-2.5 text-[11px] font-mono text-ink2 resize-none break-all"
                  />
                  <button
                    onClick={() => { navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => {}); }}
                    className="btn btn-secondary w-full min-h-10 rounded-xl text-xs"
                  >
                    {copied ? <><Check size={13} /> Copied to clipboard</> : <><Copy size={13} /> Copy code</>}
                  </button>
                </div>
              )}
            </div>

            {/* paste & restore */}
            <div className="space-y-2 pt-1 border-t border-line">
              <span className="text-[11px] font-semibold text-ink2">Restore on this device</span>
              <textarea
                value={pasteCode}
                onChange={(e) => setPasteCode(e.target.value)}
                placeholder="Paste a sync code…"
                rows={2}
                aria-label="Paste a sync code to restore"
                className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-[11px] font-mono text-ink placeholder:text-ink3 focus:outline-none focus:border-ink resize-none break-all"
              />
              <button onClick={restoreFromCode} disabled={busy || !pasteCode.trim()} className="btn btn-secondary w-full min-h-11 rounded-xl text-sm disabled:opacity-50">
                <Upload size={14} /> Restore from code
              </button>
            </div>

            {/* file backup, kept as an alternative */}
            <div className="flex gap-2 pt-1 border-t border-line">
              <button onClick={doExport} className="btn btn-secondary flex-1 min-h-10 rounded-xl text-xs">
                <Download size={13} /> Export file
              </button>
              <button onClick={() => fileRef.current?.click()} className="btn btn-secondary flex-1 min-h-10 rounded-xl text-xs">
                <Upload size={13} /> Import file
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" aria-label="Import backup file" />
            </div>

            {restored != null && (
              <p className="text-xs text-ink flex items-center gap-1.5" role="status">
                <Check size={13} /> Restored {restored} item{restored !== 1 ? 's' : ''} — reload to see everything.
              </p>
            )}
            {error && <p role="alert" className="text-xs text-ink">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
