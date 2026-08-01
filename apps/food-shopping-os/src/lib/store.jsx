import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOGUE } from '../data/foods.js';
import { DEFAULT_TARGETS } from '../data/nutrients.js';
import { guessAisle } from '../data/stores.js';
import { setMyRecipes } from '../data/recipes.js';
import {
  aisleFor, applyOffers, mergeItems, rememberAisle, routeFromTicks,
} from './shopping.js';
import { buildEntry, copyEntries } from './nutrition.js';
import { recipeFood } from './foodlog.js';
import { targetsFor } from './goals.js';
import { applyEntries, clearDates, LEFTOVER_CAT, leftoverEntry, moveMeal } from './mealplan.js';
import { deriveApp } from './derive.js';
import { consumePantryIngredients } from './kitchen.js';
import { healthActions, seedMeasurements } from './health-actions.js';
import { reminderActions } from './reminder-actions.js';
import { advancedActions, preferenceActions } from './preference-actions.js';
import { householdActions } from './household-actions.js';
import { smartActions } from './smart-actions.js';
import { DEFAULT_PERMISSIONS, householdPermission } from './household.js';
import { dueBetween, dueNow, reminderContext } from './reminders.js';
import { moveBefore } from './utils.js';
import {
  initialiseCloud, pullCloud, pushCloud, retryQueuedCloud, subscribeCloud,
} from './cloud.js';
import {
  createHealthVault, decryptHealth, encryptHealth, HEALTH_CREDENTIAL_KEY, HEALTH_FIELDS, HEALTH_VAULT_KEY,
  healthSnapshot, platformUnlockAvailable, registerPlatformUnlock, verifyPlatformUnlock, withoutHealth,
} from './health-vault.js';
import {
  hydrate, loadStoredState, parseBackup, serialiseBackup,
} from './store-persistence.js';
import { useStoreApi } from './store-api.js';

export { PHOTO_LIMIT } from './health-actions.js';

import {
  ACCENT_IDS, emojiFor, EMPTY_STATE, rolloverDay, STATE_VERSION, STORAGE_KEY, todayStamp, uid,
} from './state.js';

export {
  EMPTY_STATE, foodFromEntry, levelFromXp, recentFoodsFrom, rolloverDay, STATE_VERSION,
  STORAGE_KEY, todayStamp, XP_PER_LEVEL, xpIntoLevel,
} from './state.js';

const KEY = STORAGE_KEY;

export { hydrate, parseBackup, serialiseBackup };

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const initial = useRef(null);
  if (!initial.current) initial.current = loadStoredState();
  const [state, setState] = useState(initial.current.state);
  const [storageIssue, setStorageIssue] = useState(initial.current.issue);
  const [cloudStatus, setCloudStatus] = useState({ kind: 'checking', message: 'Checking cloud sync…' });
  const blockPersistence = useRef(initial.current.issue?.kind === 'corrupt');
  const cloudMeta = useRef(null);
  const cloudReady = useRef(false);
  const skipCloudPush = useRef(false);
  const cloudTimer = useRef(null);
  const undoHistory = useRef([]);
  const applyingRemote = useRef(false);
  const vaultKey = useRef(null);
  const vaultSalt = useRef(null);
  const vaultWrites = useRef(Promise.resolve());
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  // Reminders are due at a time, not at a state change, so the clock has to
  // move on its own. A minute is finer than any reminder needs.
  const [tick, setTick] = useState(() => Date.now());
  // Where the catch-up starts: read once, so it doesn't slide as you look at it.
  const [seenFrom] = useState(() => state.lastSeenAt);

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return undefined;
    let retrying = false;
    const retry = async () => {
      if (retrying || !cloudMeta.current) return;
      retrying = true;
      try {
        const result = await retryQueuedCloud();
        if (result) {
          cloudMeta.current = result.meta;
          cloudReady.current = result.status.kind === 'ready';
          setCloudStatus(result.status);
        }
      } finally {
        retrying = false;
      }
    };
    window.addEventListener('online', retry);
    const timer = setInterval(retry, 30000);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, []);

  /* Every write stamps the moment the app was last in front of you, which is
     what the next visit measures "while you were away" from. It's written on
     the way out rather than held in state, so the heartbeat can't re-render
     every screen once a minute. */
  const persist = (next) => {
    try {
      const stored = next.healthVaultEnabled ? withoutHealth(next, EMPTY_STATE) : next;
      localStorage.setItem(KEY, JSON.stringify({
        ...stored,
        schemaVersion: STATE_VERSION,
        lastSeenAt: Date.now(),
      }));
      if (next.healthVaultEnabled && vaultKey.current && vaultSalt.current) {
        const snapshot = healthSnapshot(next);
        vaultWrites.current = vaultWrites.current
          .then(() => encryptHealth(snapshot, vaultKey.current, vaultSalt.current))
          .then((record) => localStorage.setItem(HEALTH_VAULT_KEY, JSON.stringify(record)))
          .catch((error) => setStorageIssue({
            kind: 'write',
            message: 'Your latest health changes could not be encrypted. Keep this tab open and export a backup.',
            detail: error instanceof Error ? error.message : String(error),
            raw: null,
          }));
      }
      setStorageIssue((current) => (current?.kind === 'write' ? null : current));
      return true;
    } catch (error) {
      setStorageIssue({
        kind: 'write',
        message: 'Your latest changes could not be saved. Export a backup before closing Forq.',
        detail: error instanceof Error ? error.message : String(error),
        raw: null,
      });
      return false;
    }
  };

  useEffect(() => {
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    if (!blockPersistence.current) persist(state);
  }, [state]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key !== KEY || !event.newValue) return;
      try {
        applyingRemote.current = true;
        undoHistory.current = [];
        setState(parseBackup(event.newValue));
      } catch {
        // Ignore incomplete writes from another tab.
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // Leaving is the most accurate moment to stamp, and there may be no render
  // left after it — so this one writes directly.
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return undefined;
    let cancelled = false;
    let poll;
    let unsubscribeRealtime;
    const pullNewerState = async () => {
      if (!cloudMeta.current) return;
      const update = await pullCloud(cloudMeta.current);
      if (update.state) {
        cloudMeta.current = update.meta;
        skipCloudPush.current = true;
        setState(hydrate(update.state));
        setCloudStatus(update.status);
      }
    };
    const loadCloud = async () => {
      const result = await initialiseCloud(latest.current);
      if (cancelled) return;
      cloudMeta.current = result.meta || null;
      cloudReady.current = result.status.kind === 'ready';
      setCloudStatus(result.status);
      if (result.state) {
        skipCloudPush.current = true;
        setState(hydrate(result.state));
      }
      if (result.meta && result.status.kind === 'ready') {
        poll = setInterval(pullNewerState, 60000);
        subscribeCloud(result.meta, (event) => {
          if (event.deviceId === result.meta.deviceId) return;
          if (Number(event.version) <= Number(cloudMeta.current?.version || 0)) return;
          pullNewerState();
        }).then((unsubscribe) => {
          if (cancelled) unsubscribe();
          else {
            unsubscribeRealtime = unsubscribe;
            setCloudStatus({ kind: 'ready', message: 'Live household sync connected.' });
          }
        }).catch(() => {
          setCloudStatus({ kind: 'ready', message: 'Cloud sync ready. Checking for changes every minute.' });
        });
      }
    };
    loadCloud();
    return () => {
      cancelled = true;
      clearInterval(poll);
      unsubscribeRealtime?.();
    };
  }, []);

  useEffect(() => {
    if (!cloudReady.current || !cloudMeta.current) return;
    if (skipCloudPush.current) {
      skipCloudPush.current = false;
      return;
    }
    clearTimeout(cloudTimer.current);
    cloudTimer.current = setTimeout(async () => {
      const result = await pushCloud({
        ...latest.current,
        ...(latest.current.healthVaultEnabled && !vaultKey.current ? { __preserveHealth: true } : {}),
      }, cloudMeta.current);
      cloudMeta.current = result.meta;
      if (result.status.kind !== 'ready') cloudReady.current = false;
      setCloudStatus(result.status);
    }, 750);
    return () => clearTimeout(cloudTimer.current);
  }, [state]);

  useEffect(() => {
    const mark = () => {
      if (!blockPersistence.current) persist(latest.current);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') mark(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', mark);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', mark);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.accent = state.accent;
  }, [state.theme, state.accent]);

  // Your recipes join the book's lookup, so a plan slot or a cook history entry
  // pointing at one of yours resolves like any other dish.
  setMyRecipes(state.myRecipes);

  const api = useStoreApi({
    blockPersistence, cloudStatus, latest, setState, setStorageIssue, storageIssue,
    undoHistory, vaultKey, vaultSalt, vaultWrites, setVaultUnlocked,
  });

  /* Everything below is derived — the app never stores a number twice. */
  const derived = useMemo(() => deriveApp(state), [state]);

  /* Reminders answer to the clock as well as to your data, so they're derived
     against the tick rather than only against state changes. */
  const alerts = useMemo(() => {
    const now = new Date(tick);
    const due = dueNow(state.reminders, { now, done: state.reminderDone });
    return {
      remindersDue: due,
      // What came due while the app was shut. It can't notify you then — no
      // server to wake it — so the least it can do is not pretend otherwise.
      remindersMissed: dueBetween(state.reminders, seenFrom, tick, state.reminderDone)
        .filter((m) => !due.some((d) => d.reminder.id === m.reminder.id && d.stamp === m.stamp && d.time === m.time)),
      now,
    };
  }, [state.reminders, state.reminderDone, seenFrom, tick]);

  const value = useMemo(() => ({
    ...state,
    ...derived,
    ...alerts,
    reminderLine: (kind) => reminderContext(kind, { ...state, ...derived }),
    healthVault: {
      enabled: state.healthVaultEnabled,
      unlocked: vaultUnlocked,
      platformAvailable: platformUnlockAvailable(),
    },
    ...api,
  }), [state, derived, alerts, api, vaultUnlocked]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
};

export const useOptionalApp = () => useContext(AppContext);
