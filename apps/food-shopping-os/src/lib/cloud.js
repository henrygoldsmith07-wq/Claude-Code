const META_KEY = 'forq-cloud-meta-v1';

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

export async function pushCloud(state, meta) {
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
    return {
      meta,
      status: {
        kind: error.status === 409 ? 'conflict' : (navigator.onLine ? 'error' : 'offline'),
        message: error.status === 409
          ? 'This household changed on another device. Export a backup, then reload to use the newer copy.'
          : (navigator.onLine ? error.message : 'Offline. Changes will sync when Forq is reopened online.'),
      },
    };
  }
}

export function selectCloudHousehold(householdId) {
  saveMeta({ ...readMeta(), householdId, version: 0 });
}
