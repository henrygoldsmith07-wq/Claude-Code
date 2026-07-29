import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSameOrigin } from '../src/server/api.js';
import { aiRequestSchema, invitationSchema, syncSchema } from '../src/server/schemas.js';
import { down, up } from '../scripts/migrations/001-initial-backend.mjs';
import { initialiseCloud, pushCloud } from '../src/lib/cloud.js';

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

describe('MongoDB migrations', () => {
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
    expect(created).toHaveLength(11);
    expect(dropped).toHaveLength(11);
    expect(created[0][2]).toBe('personal_owner_unique');
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
});
