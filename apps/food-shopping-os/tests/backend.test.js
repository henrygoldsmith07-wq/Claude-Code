import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSameOrigin } from '../src/server/api.js';
import {
  aiRequestSchema, calendarRangeSchema, coachShareSchema, invitationSchema, syncSchema,
} from '../src/server/schemas.js';
import { down, up } from '../scripts/migrations/001-initial-backend.mjs';
import {
  initialiseCloud, pushCloud, retryQueuedCloud, subscribeCloud,
} from '../src/lib/cloud.js';
import { deleteHouseholdData } from '../src/server/households.js';

describe('backend contracts', () => {
  it('accepts a complete versioned sync payload', () => {
    const payload = syncSchema.parse({
      version: 0,
      deviceId: 'device-123456',
      state: { onboarded: true, schemaVersion: 3, pantry: [] },
    });
    expect(payload.state.pantry).toEqual([]);
  });

  it('rejects incomplete state and unbounded identifiers', () => {
    expect(() => syncSchema.parse({ version: 0, deviceId: 'short', state: {} })).toThrow();
  });

  it('validates invitations and AI tasks', () => {
    expect(invitationSchema.parse({
      email: 'person@example.com',
      role: 'adult',
      permissions: ['shopping', 'pantry'],
    }).email).toBe('person@example.com');
    expect(() => aiRequestSchema.parse({ task: 'diagnose', prompt: 'x' })).toThrow();
  });

  it('rejects cross-origin mutations', () => {
    const request = new Request('https://forq.example/api/sync', {
      headers: { origin: 'https://attacker.example' },
    });
    expect(() => assertSameOrigin(request)).toThrowError('Invalid request origin.');
  });
});

describe('database migrations', () => {
  it('creates and reverses every named index', async () => {
    const created = [];
    const dropped = [];
    const db = {
      collection: (name) => ({
        createIndex: async (keys, options) => created.push([name, keys, options.name]),
        dropIndex: async (index) => dropped.push([name, index]),
      }),
    };
    await up(db);
    await down(db);
    expect(created).toHaveLength(14);
    expect(dropped).toHaveLength(14);
    expect(created[0][2]).toBe('personal_owner_unique');
  });
});

describe('household erasure', () => {
  it('removes every record keyed to the household', async () => {
    const calls = [];
    const db = {
      collection: (name) => ({
        deleteMany: async (query) => {
          calls.push([name, query]);
          return { deletedCount: 1 };
        },
      }),
    };
    const householdId = { toString: () => 'household-id' };
    const deleted = await deleteHouseholdData(db, householdId);

    expect(calls.map(([name]) => name)).toEqual([
      'householdStates',
      'memberships',
      'invitations',
      'coachShares',
      'uploads',
      'notificationOutbox',
      'auditEvents',
      'aiUsage',
      'realtimeEvents',
    ]);
    for (const [, query] of calls) expect(query).toEqual({ householdId });
    expect(deleted.uploads).toBe(1);
  });

  it('bounds coach shares and calendar reads', () => {
    expect(coachShareSchema.parse({
      label: 'Trainer',
      scopes: ['diary', 'nutrition'],
      expiresInDays: 30,
    }).scopes).toEqual(['diary', 'nutrition']);
    expect(() => coachShareSchema.parse({ label: 'Trainer', scopes: [], expiresInDays: 30 })).toThrow();
    expect(calendarRangeSchema.parse({
      provider: 'google',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-08T00:00:00.000Z',
    }).provider).toBe('google');
    expect(() => calendarRangeSchema.parse({
      provider: 'google',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-08-08T00:00:00.000Z',
    })).toThrow();
  });
});

describe('offline-first cloud migration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('pulls an existing household state after authentication', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true, authenticated: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        householdId: '507f1f77bcf86cd799439011',
        version: 4,
        state: { onboarded: true, schemaVersion: 3 },
      }), { status: 200 })));
    const result = await initialiseCloud({ onboarded: false });
    expect(result.status.kind).toBe('ready');
    expect(result.meta.version).toBe(4);
    expect(result.state.onboarded).toBe(true);
  });

  it('reports an optimistic concurrency conflict without replacing local data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'A newer household version is available.' }),
      { status: 409 },
    )));
    const result = await pushCloud(
      { onboarded: true },
      { version: 2, deviceId: 'device-123456', householdId: 'household' },
    );
    expect(result.status.kind).toBe('conflict');
    expect(result.meta.version).toBe(2);
  });

  it('queues failed writes and retries them after reconnecting', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));
    const meta = { version: 2, deviceId: 'device-123456', householdId: 'household' };
    const queued = await pushCloud({ onboarded: true }, meta);
    expect(queued.status.kind).toBe('offline');
    expect(localStorage.getItem('forq-cloud-queue-v1')).toContain('onboarded');

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: 3 }), { status: 200 })));
    const retried = await retryQueuedCloud();
    expect(retried.status.kind).toBe('ready');
    expect(localStorage.getItem('forq-cloud-queue-v1')).toBeNull();
  });

  it('subscribes to the private household stream and closes it cleanly', async () => {
    const listeners = {};
    const close = vi.fn();
    class EventSourceMock {
      constructor(url) {
        this.url = String(url);
        EventSourceMock.instance = this;
      }

      addEventListener(name, handler) {
        listeners[name] = handler;
      }

      close() {
        close();
      }
    }
    vi.stubGlobal('EventSource', EventSourceMock);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      token: 'short-lived-ably-token',
      expires: Date.now() + 3600000,
    }), { status: 200 })));
    const changed = vi.fn();
    const unsubscribe = await subscribeCloud({
      householdId: 'household-1',
      deviceId: 'device-1',
    }, changed);
    const url = new URL(EventSourceMock.instance.url);
    expect(url.hostname).toBe('main.realtime.ably.net');
    expect(url.searchParams.get('channels')).toBe('household:household-1');
    listeners.message({ data: JSON.stringify({ name: 'changed', data: JSON.stringify({ version: 3 }) }) });
    expect(changed).toHaveBeenCalledWith({ version: 3 });
    unsubscribe();
    expect(close).toHaveBeenCalled();
  });

  it('uses the Redis SSE stream when Ably is unavailable', async () => {
    const listeners = {};
    const close = vi.fn();
    class EventSourceMock {
      constructor(url) {
        this.url = String(url);
        EventSourceMock.instance = this;
      }

      addEventListener(name, handler) {
        listeners[name] = handler;
      }

      close() {
        close();
      }
    }
    vi.stubGlobal('EventSource', EventSourceMock);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ fallback: 'redis' }))));
    const changed = vi.fn();
    const unsubscribe = await subscribeCloud({ householdId: 'household-1', deviceId: 'device-1' }, changed);
    const url = new URL(EventSourceMock.instance.url, window.location.origin);
    expect(url.pathname).toBe('/api/realtime/stream');
    expect(url.searchParams.get('householdId')).toBe('household-1');
    listeners.changed({ data: JSON.stringify({ version: 4 }) });
    expect(changed).toHaveBeenCalledWith({ version: 4 });
    unsubscribe();
    expect(close).toHaveBeenCalled();
  });
});
