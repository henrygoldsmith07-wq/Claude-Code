import { Cloud, CloudOff, Flame, LoaderCircle, Sparkles } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { greeting, prettyDate } from '../lib/utils.js';
import { setupProgress } from '../lib/setup.js';
import { Pill } from './ui.jsx';

const TITLES = {
  home: null, // Home says hello instead — it's the one screen that greets you
  plan: { title: 'Meal planner', eyebrow: 'Build your week' },
  log: { title: 'Food diary', eyebrow: 'Track meals and nutrition' },
  shop: { title: 'Shop', eyebrow: 'Your list, history and stores' },
  recipes: { title: 'Recipes', eyebrow: 'Find something worth cooking' },
};

/**
 * One header on every screen, so the way to your profile is the same wherever
 * you are.
 *
 * It used to live only on Home, which meant Profile was two taps from four of
 * the five tabs and one from the other. Now the avatar is always in the same
 * corner — and taking Profile out of the bottom bar gave the five tabs you
 * actually work in a fifth more width each.
 */
export default function AppHeader({ tab, onProfile, onGuidance }) {
  const app = useApp();
  const screen = TITLES[tab];
  const setup = setupProgress(app);
  const live = app.cloudStatus?.kind === 'live';
  const reconnecting = app.cloudStatus?.kind === 'reconnecting' || app.cloudStatus?.kind === 'connecting';
  const hasSyncStatus = Boolean(app.cloudStatus?.kind && app.cloudStatus.kind !== 'checking');
  const SyncIcon = live ? Cloud : reconnecting ? LoaderCircle : CloudOff;

  return (
    <header className="app-header px-5 pt-12 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {screen ? (
            <>
              <p className="text-[0.75rem] font-bold" style={{ color: 'var(--muted)' }}>{screen.eyebrow}</p>
              <h1 className="text-[1.75rem] font-extrabold tracking-tight leading-tight">{screen.title}</h1>
            </>
          ) : (
            <>
              <p className="text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>{prettyDate()}</p>
              {/* A shade smaller than a screen title: it has a name in it,
                  and it has to clear the two buttons on the right. */}
              <h1 className="text-[1.375rem] font-extrabold tracking-tight leading-tight">
                {greeting()}, {app.name}
              </h1>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The coach used to float over the bottom-right corner, which is
              exactly where the screen's primary action now lives. It reads
              better up here anyway: it's a thing you ask, not a thing you do. */}
          <button
            onClick={onGuidance}
            aria-label="Guidance — what matters now"
            className="press flex h-11 w-11 items-center justify-center rounded-full border"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            <Sparkles size={19} strokeWidth={1.9} />
          </button>

          <button
            onClick={onProfile}
            // The one control that is in the same place on every screen.
            aria-label={`You — profile and settings${setup.done < setup.total ? `, ${setup.total - setup.done} setup steps left` : ''}`}
            className="press relative flex h-11 w-11 items-center justify-center rounded-full text-lg font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {app.name[0]?.toUpperCase() || '?'}
            {!setup.complete && (
              // A quiet dot, not a red badge: there's nothing wrong, there's
              // just something left to try.
              <span
                className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
                style={{ background: 'var(--accent-deep)', borderColor: 'var(--bg)' }}
              />
            )}
          </button>
        </div>
      </div>

      {tab === 'home' && (app.streak > 0 || app.xp > 0) && (
        <div className="mt-3 flex gap-2">
          {app.streak > 0 && <Pill tone="accent"><Flame size={12} /> {app.streak}-day cooking streak</Pill>}
          <Pill tone="muted">Level {app.level.level} · {app.xp.toLocaleString()} XP</Pill>
        </div>
      )}

      {hasSyncStatus && (
        <div className={live || reconnecting ? 'mt-2' : 'sr-only'} role="status" aria-label={app.cloudStatus.message}>
          {live || reconnecting ? (
            <Pill tone={live ? 'accent' : 'muted'}>
              <SyncIcon size={12} className={reconnecting ? 'animate-spin' : undefined} />
              {live ? 'Live household' : 'Reconnecting'}
            </Pill>
          ) : app.cloudStatus.message}
        </div>
      )}
    </header>
  );
}
