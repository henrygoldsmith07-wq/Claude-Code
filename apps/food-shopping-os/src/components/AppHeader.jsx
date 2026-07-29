import { Flame, Sparkles } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { greeting, prettyDate } from '../lib/utils.js';
import { setupProgress } from '../lib/setup.js';
import { Pill } from './ui.jsx';

const TITLES = {
  home: null, // Home says hello instead — it's the one screen that greets you
  plan: 'Meal planner',
  log: 'Food diary',
  shop: 'Shop',
  recipes: 'Recipes',
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
export default function AppHeader({ tab, onProfile, onAi }) {
  const app = useApp();
  const title = TITLES[tab];
  const setup = setupProgress(app);

  return (
    <header className="px-5 pt-12 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? (
            <h1 className="text-[26px] font-extrabold tracking-tight leading-tight">{title}</h1>
          ) : (
            <>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{prettyDate()}</p>
              {/* A shade smaller than a screen title: it has a name in it,
                  and it has to clear the two buttons on the right. */}
              <h1 className="text-[22px] font-extrabold tracking-tight leading-tight">
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
            onClick={onAi}
            aria-label="AI food coach"
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
    </header>
  );
}
