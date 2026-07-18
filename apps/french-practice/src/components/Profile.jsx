import { useEffect, useMemo, useState } from 'react';
import {
  getXp, getStreak, getSessions, getReviewLog, getGrammarProgress, getNotebook,
  getCoins, addCoins, spendCoins,
  getAchievements, unlockAchievement,
  getChallengeState, claimChallenge, getTodayXp,
  getAvatar, setAvatar, getOwnedAvatars, ownAvatar,
  getCollectibles, awardCollectible, getEventXp,
} from '../lib/storage';
import {
  levelFromXp, AVATARS, ACHIEVEMENTS, dailyChallenges, COLLECTIBLES,
  nextCollectible, earnedBadgeCollectibles, activeEvent,
} from '../lib/game';
import { totalReviews } from '../lib/memory';
import { X, Check, Flame, Bolt, Coins, Trophy, Lock } from './icons';

// Player profile: level & title, coins, daily challenges, the avatar shop,
// achievements, the postcard collection and the seasonal event. All
// single-player — rewards are earned locally, never ranked against others.

export default function Profile({ open, onClose, onXp, onHeaderChange }) {
  const [tick, setTick] = useState(0);
  const [newBadges, setNewBadges] = useState([]);
  const [newCards, setNewCards] = useState([]);
  const refresh = () => setTick((t) => t + 1);

  // On open: evaluate achievements, grant their coins/avatars, then hand
  // out any badge-count or seasonal collectibles that are now earned.
  useEffect(() => {
    if (!open) return;
    const unlockedNow = [];
    const cardsNow = [];
    const stats = buildStats();
    for (const a of ACHIEVEMENTS) {
      if (!getAchievements()[a.id] && a.check(stats)) {
        unlockAchievement(a.id);
        addCoins(a.coins);
        const gift = AVATARS.find((av) => av.achievement === a.id);
        if (gift) ownAvatar(gift.id);
        unlockedNow.push(a.id);
      }
    }
    const badgeCount = Object.keys(getAchievements()).length;
    for (const c of earnedBadgeCollectibles(getCollectibles(), badgeCount)) {
      awardCollectible(c.id);
      cardsNow.push(c.id);
    }
    const event = activeEvent();
    if (event && getEventXp(event.id) >= event.goal && awardCollectible(event.collectible)) {
      cardsNow.push(event.collectible);
    }
    setNewBadges(unlockedNow);
    setNewCards(cardsNow);
    refresh();
  }, [open]);

  const data = useMemo(() => {
    void tick;
    return {
      xp: getXp(),
      coins: getCoins(),
      streak: getStreak().count,
      avatarId: getAvatar(),
      owned: getOwnedAvatars(),
      achievements: getAchievements(),
      collectibles: getCollectibles(),
      challenges: getChallengeState(),
    };
  }, [tick, open]);

  useEffect(() => {
    onHeaderChange?.({ coins: data.coins, avatarId: data.avatarId });
  }, [data.coins, data.avatarId]);

  if (!open) return null;

  const level = levelFromXp(data.xp);
  const avatar = AVATARS.find((a) => a.id === data.avatarId) || AVATARS[0];

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Profile">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface shrink-0">
        <h2 className="flex-1 text-sm font-semibold text-ink">Your profile</h2>
        <button onClick={onClose} aria-label="Close profile" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll px-4 py-5">
        <div className="max-w-md mx-auto space-y-5">
          {/* identity: avatar, level, title, progress */}
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-4">
              <span className="w-16 h-16 grid place-items-center rounded-2xl bg-surface2 border border-line text-4xl" role="img" aria-label={avatar.name}>
                {avatar.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-ink">Niveau {level.level} · {level.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-ink2">
                  <span className="inline-flex items-center gap-1"><Bolt size={12} /> {data.xp.toLocaleString('en-GB')} XP</span>
                  <span className="inline-flex items-center gap-1"><Coins size={12} /> {data.coins}</span>
                  <span className="inline-flex items-center gap-1"><Flame size={12} /> {data.streak}-day</span>
                </div>
              </div>
            </div>
            <div>
              <div className="h-2 rounded-full bg-surface2 overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.round(level.progress * 100)}%` }} />
              </div>
              <p className="text-[11px] text-ink3 mt-1 tabular-nums">
                {level.intoLevel}/{level.needed} XP to niveau {level.level + 1}
              </p>
            </div>
          </div>

          <DailyChallenges data={data} onXp={onXp} onChange={refresh} onNewCard={(id) => setNewCards((c) => [...c, id])} />
          <SeasonalEvent collectibles={data.collectibles} />
          <AvatarShop data={data} onChange={refresh} />
          <AchievementsGrid achievements={data.achievements} fresh={newBadges} />
          <CollectiblesGrid collectibles={data.collectibles} fresh={newCards} />
        </div>
      </div>
    </div>
  );
}

function buildStats() {
  const xp = getXp();
  return {
    xp,
    level: levelFromXp(xp).level,
    streak: getStreak().count,
    sessions: getSessions().length,
    reviews: totalReviews(getReviewLog()),
    grammarMastered: Object.values(getGrammarProgress()).filter((g) => g.best >= 80).length,
    notebook: getNotebook().length,
    collectibles: Object.keys(getCollectibles()).length,
  };
}

// Three deterministic challenges per day; completing all three earns the
// next postcard in the challenge set.
function DailyChallenges({ data, onXp, onChange, onNewCard }) {
  const todays = useMemo(() => dailyChallenges(data.challenges.day), [data.challenges.day]);

  const progressOf = (c) =>
    c.metric === 'xp' ? getTodayXp() : (data.challenges.counts[c.metric] || 0);

  const claim = (c) => {
    claimChallenge(c.id);
    addCoins(c.coins);
    onXp(c.xp);
    const nowClaimed = getChallengeState().claimed;
    if (todays.every((t) => nowClaimed.includes(t.id))) {
      const card = nextCollectible(getCollectibles(), 'challenges');
      if (card) {
        awardCollectible(card.id);
        onNewCard(card.id);
      }
    }
    onChange();
  };

  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Daily challenges</h3>
      {todays.map((c) => {
        const progress = Math.min(c.target, progressOf(c));
        const complete = progress >= c.target;
        const claimed = data.challenges.claimed.includes(c.id);
        return (
          <div key={c.id} className="bg-surface border border-line rounded-2xl px-4 py-3.5 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink" lang="fr">{c.title}</p>
                <p className="text-xs text-ink3">{c.desc} · +{c.coins} <Coins size={10} className="inline" /> +{c.xp} XP</p>
              </div>
              {claimed ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink2"><Check size={13} /> Done</span>
              ) : complete ? (
                <button onClick={() => claim(c)} className="btn btn-primary min-h-9 px-3.5 rounded-lg text-xs">Claim</button>
              ) : (
                <span className="text-xs text-ink3 tabular-nums">{progress}/{c.target}</span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${claimed ? 'bg-line' : 'bg-accent'}`} style={{ width: `${Math.round((progress / c.target) * 100)}%` }} />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-ink3">Clear all three to earn the next postcard for your collection.</p>
    </section>
  );
}

function SeasonalEvent({ collectibles }) {
  const event = activeEvent();
  if (!event) return null;
  const progress = Math.min(event.goal, getEventXp(event.id));
  const done = Boolean(collectibles[event.collectible]);
  const card = COLLECTIBLES.find((c) => c.id === event.collectible);
  return (
    <section className="bg-surface border border-line rounded-2xl p-5 space-y-2.5">
      <div className="flex items-center gap-3">
        <span className="text-3xl" role="img" aria-hidden="true">{event.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink" lang="fr">{event.title}</p>
          <p className="text-xs text-ink3">Seasonal event — earn {event.goal} XP while it runs</p>
        </div>
        {done && <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink2"><Check size={13} /> {card.emoji}</span>}
      </div>
      <div className="h-2 rounded-full bg-surface2 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${done ? 'bg-line' : 'bg-accent'}`} style={{ width: `${Math.round((progress / event.goal) * 100)}%` }} />
      </div>
      <p className="text-[11px] text-ink3 tabular-nums">
        {done ? `Reward earned: ${card.title}` : `${progress}/${event.goal} XP → exclusive postcard: ${card.title}`}
      </p>
    </section>
  );
}

// Unlockable content: buy avatars with coins, or earn them via achievements.
function AvatarShop({ data, onChange }) {
  const buyOrSelect = (a) => {
    if (data.owned.includes(a.id)) {
      setAvatar(a.id);
      onChange();
      return;
    }
    if (a.achievement) return; // earned, not bought
    if (spendCoins(a.cost) != null) {
      ownAvatar(a.id);
      setAvatar(a.id);
      onChange();
    }
  };

  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Avatars</h3>
      <div className="grid grid-cols-3 gap-2.5">
        {AVATARS.map((a) => {
          const owned = data.owned.includes(a.id);
          const selected = data.avatarId === a.id;
          const affordable = !a.achievement && data.coins >= (a.cost || 0);
          const badge = ACHIEVEMENTS.find((x) => x.id === a.achievement);
          return (
            <button
              key={a.id}
              onClick={() => buyOrSelect(a)}
              disabled={!owned && (Boolean(a.achievement) || !affordable)}
              aria-pressed={selected}
              aria-label={`${a.name}${selected ? ' (selected)' : owned ? '' : a.achievement ? ` — unlock via ${badge?.title}` : ` — costs ${a.cost} coins`}`}
              className={`relative bg-surface border rounded-2xl p-3 text-center transition-colors ${
                selected ? 'border-ink' : 'border-line hover:border-ink3'
              } ${!owned && (a.achievement || !affordable) ? 'opacity-55' : ''}`}
            >
              <span className={`block text-3xl ${owned ? '' : 'grayscale'}`} role="img" aria-hidden="true">{a.emoji}</span>
              <span className="block text-[11px] font-semibold text-ink mt-1 truncate" lang="fr">{a.name}</span>
              <span className="block text-[10px] text-ink3 mt-0.5">
                {selected ? 'Selected' : owned ? 'Tap to use' : a.achievement ? (
                  <span className="inline-flex items-center gap-0.5"><Lock size={9} /> {badge?.title}</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5"><Coins size={9} /> {a.cost}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AchievementsGrid({ achievements, fresh }) {
  const unlocked = Object.keys(achievements).length;
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2 inline-flex items-center gap-1.5"><Trophy size={12} /> Achievements</h3>
        <span className="text-[11px] text-ink3 tabular-nums">{unlocked}/{ACHIEVEMENTS.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {ACHIEVEMENTS.map((a) => {
          const has = Boolean(achievements[a.id]);
          const isNew = fresh.includes(a.id);
          return (
            <div key={a.id} className={`relative bg-surface border rounded-2xl px-3.5 py-3 ${has ? 'border-line' : 'border-line opacity-55'}`}>
              {isNew && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-accent text-onaccent text-[9px] font-bold uppercase">New</span>
              )}
              <span className={`text-2xl ${has ? '' : 'grayscale'}`} role="img" aria-hidden="true">{a.emoji}</span>
              <p className="text-xs font-semibold text-ink mt-1" lang="fr">{a.title}</p>
              <p className="text-[10px] text-ink3 leading-snug">{a.desc} · +{a.coins} coins</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CollectiblesGrid({ collectibles, fresh }) {
  const owned = Object.keys(collectibles).length;
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Postcard collection</h3>
        <span className="text-[11px] text-ink3 tabular-nums">{owned}/{COLLECTIBLES.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {COLLECTIBLES.map((c) => {
          const has = Boolean(collectibles[c.id]);
          const isNew = fresh.includes(c.id);
          return (
            <div
              key={c.id}
              title={has ? c.title : `${c.title} — ${c.hint}`}
              className={`relative aspect-square bg-surface border border-line rounded-2xl grid place-items-center ${has ? '' : 'opacity-45'}`}
            >
              {isNew && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-accent text-onaccent text-[9px] font-bold uppercase">New</span>
              )}
              <span className={`text-2xl ${has ? '' : 'grayscale'}`} role="img" aria-label={has ? c.title : `Locked: ${c.hint}`}>
                {has ? c.emoji : '❔'}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-ink3">Postcards are earned, never bought — challenges, achievements and seasonal events.</p>
    </section>
  );
}
