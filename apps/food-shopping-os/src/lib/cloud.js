const META_KEY = 'forq-cloud-meta-v1';
const QUEUE_KEY = 'forq-cloud-queue-v1';

const readMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}');
  } catch {
    return {};
  }
};

const deviceId = () => {
  const meta = readMeta();
  if (!meta.deviceId) meta.deviceId = crypto.randomUUID();
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  return meta.deviceId;
};

const saveMeta = (next) => {
  localStorage.setItem(META_KEY, JSON.stringify(next));
  return next;
};

const readQueue = () => {
  try {
    const queued = JSON.parse(localStorage.getItem(QUEUE_KEY) || 'null');
    return queued?.state && queued?.meta ? queued : null;
  } catch {
    return null;
  }
};

const saveQueue = (state, meta) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ state, meta, queuedAt: Date.now() }));
  } catch {
    // The main local store reports storage failures; sync queuing is best effort.
  }
};

const syncState = (state) => ({
  ...state,
  syncTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
});

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Cloud request failed.');
    error.status = response.status;
    throw error;
  }
  return body;
};

export async function initialiseCloud(localState) {
  try {
    const status = await request('/api/backend/status');
    if (!status.enabled) return { status: { kind: 'disabled', message: 'Add backend environment variables to enable cloud sync.' } };
    if (!status.authenticated) return { status: { kind: 'signed-out', message: 'Sign in to sync this device.' } };
    const saved = readMeta();
    const remote = await request('/api/sync', {
      headers: saved.householdId ? { 'x-forq-household-id': saved.householdId } : {},
    });
    let meta = {
      deviceId: deviceId(),
      householdId: remote.householdId,
      version: remote.version,
    };
    if (remote.state) {
      saveMeta(meta);
      return {
        state: remote.state,
        meta,
        status: { kind: 'ready', message: 'Synced with your household.' },
      };
    }
    if (localState.onboarded) {
      const result = await request('/api/sync', {
        method: 'PUT',
        body: JSON.stringify({ version: 0, deviceId: meta.deviceId, state: syncState(localState) }),
      });
      meta = saveMeta({ ...meta, version: result.version });
    } else {
      saveMeta(meta);
    }
    return { meta, status: { kind: 'ready', message: 'Cloud sync is ready.' } };
  } catch (error) {
    return {
      status: {
        kind: navigator.onLine ? 'error' : 'offline',
        message: navigator.onLine ? error.message : 'Offline. Changes will remain on this device.',
      },
    };
  }
}

export async function pushCloud(state, meta, { queueOnFailure = true } = {}) {
  try {
    const result = await request('/api/sync', {
      method: 'PUT',
      headers: meta.householdId ? { 'x-forq-household-id': meta.householdId } : {},
      body: JSON.stringify({ version: meta.version, deviceId: meta.deviceId, state: syncState(state) }),
    });
    return {
      meta: saveMeta({ ...meta, version: result.version }),
      status: { kind: 'ready', message: 'All changes synced.' },
    };
  } catch (error) {
    if (queueOnFailure && error.status !== 409) saveQueue(state, meta);
    return {
      meta,
      status: {
        kind: error.status === 409 ? 'conflict' : (navigator.onLine ? 'error' : 'offline'),
        message: error.status === 409
          ? 'This household changed on another device. Export a backup, then reload to use the newer copy.'
          : (navigator.onLine ? error.message : 'Offline changes queued. They will sync automatically when you reconnect.'),
      },
    };
  }
}

export async function retryQueuedCloud() {
  const queued = readQueue();
  if (!queued) return null;
  const result = await pushCloud(queued.state, queued.meta, { queueOnFailure: false });
  if (result.status.kind === 'ready') localStorage.removeItem(QUEUE_KEY);
  return result;
}

export function hasQueuedCloud() {
  return Boolean(readQueue());
}

export function selectCloudHousehold(householdId) {
  saveMeta({ ...readMeta(), householdId, version: 0 });
}

export async function pullCloud(meta) {
  try {
    const remote = await request('/api/sync', {
      headers: meta.householdId ? { 'x-forq-household-id': meta.householdId } : {},
    });
    return {
      state: remote.version > meta.version ? remote.state : null,
      meta: saveMeta({ ...meta, householdId: remote.householdId, version: remote.version }),
      status: { kind: 'ready', message: 'Household changes received live.' },
    };
  } catch (error) {
    return {
      state: null,
      meta,
      status: {
        kind: navigator.onLine ? 'error' : 'offline',
        message: navigator.onLine ? error.message : 'Offline. Live changes will resume when you reconnect.',
      },
    };
  }
}

export async function subscribeCloud(meta, onChanged) {
  if (typeof EventSource === 'undefined') throw new Error('Live updates are not supported by this browser.');
  let source;
  let refreshTimer;
  let reconnectTimer;
  let stopped = false;
  let redisSince = new Date(Date.now() - 10000).toISOString();
  const connectRedis = () => {
    if (stopped) return;
    source?.close();
    const url = new URL('/api/realtime/stream', window.location.origin);
    url.search = new URLSearchParams({
      householdId: meta.householdId,
      since: redisSince,
    });
    source = new EventSource(url);
    source.addEventListener('changed', (event) => {
      try {
        const data = JSON.parse(event.data);
        redisSince = new Date().toISOString();
        onChanged(data || {});
      } catch {
        // Ignore malformed provider messages; the stream reconnects on failure.
      }
    });
    source.onerror = () => {
      source?.close();
      if (!stopped) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectRedis, 3000);
      }
    };
  };
  const connect = async () => {
    const auth = await request('/api/realtime/token', {
      method: 'POST',
      headers: meta.householdId ? { 'x-forq-household-id': meta.householdId } : {},
      body: '{}',
    }).catch(() => ({ fallback: 'redis' }));
    if (stopped) return;
    if (auth.fallback === 'redis') {
      connectRedis();
      return;
    }
    source?.close();
    const url = new URL('https://main.realtime.ably.net/sse');
    url.search = new URLSearchParams({
      channels: `household:${meta.householdId}`,
      v: '1.2',
      accessToken: auth.token,
      enveloped: 'true',
    });
    source = new EventSource(url);
    source.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.name !== 'changed') return;
        const data = typeof message.data === 'string' ? JSON.parse(message.data) : message.data;
        onChanged(data || {});
      } catch {
        // Ignore malformed provider messages; the provider refresh still runs.
      }
    });
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(connect, Math.max(60000, Number(auth.expires) - Date.now() - 60000));
  };
  await connect();
  return () => {
    stopped = true;
    clearTimeout(refreshTimer);
    clearTimeout(reconnectTimer);
    source?.close();
  };
}

const selectedHeaders = () => {
  const householdId = readMeta().householdId;
  return householdId ? { 'x-forq-household-id': householdId } : {};
};

export const listCoachShares = () => request('/api/coach-shares', { headers: selectedHeaders() });

export const createCoachShare = (input) => request('/api/coach-shares', {
  method: 'POST',
  headers: selectedHeaders(),
  body: JSON.stringify(input),
});

export const revokeCoachShare = (id) => request(`/api/coach-shares?id=${encodeURIComponent(id)}`, {
  method: 'DELETE',
  headers: selectedHeaders(),
  body: '{}',
});

export const listHouseholdAudit = () => request('/api/households/audit', {
  headers: selectedHeaders(),
});

export function selectedCloudHouseholdId() {
  return readMeta().householdId || null;
}

export function forgetCloudHousehold() {
  localStorage.removeItem(META_KEY);
}
