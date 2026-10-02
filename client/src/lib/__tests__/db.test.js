import { describe, test, expect, beforeEach, vi } from 'vitest';
import { getDB, queueWrite, syncOutbox, getOutboxStatus, DB_NAME } from '../db';

async function resetDB() {
  try {
    const db = await getDB();
    await db.clear('outbox');
    await db.clear('members');
    db.close();
  } catch {}
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await resetDB();
  localStorage.setItem('token', 'fake-test-token');
  vi.restoreAllMocks();
});

describe('offline sync engine', () => {
  test('a record created offline shows up instantly under its temp id', async () => {
    const db = await getDB();
    const tempId = 'local-abc';
    await db.put('members', { _id: tempId, firstName: 'Test', pendingSync: true });

    const local = await db.get('members', tempId);
    expect(local.firstName).toBe('Test');
  });

  test('once the queued write syncs, the temp record is replaced with the real server record', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _id: 'real-server-id', firstName: 'Test' }),
    });

    const db = await getDB();
    const tempId = 'local-abc';
    await db.put('members', { _id: tempId, firstName: 'Test', pendingSync: true });

    await queueWrite({
      method: 'POST',
      url: '/api/members',
      body: { firstName: 'Test' },
      localStore: 'members',
      tempId,
    });
    await syncOutbox();

    const stillTemp = await db.get('members', tempId);
    const real = await db.get('members', 'real-server-id');
    expect(stillTemp).toBeUndefined();
    expect(real.firstName).toBe('Test');
  });

  test('regression: two overlapping syncOutbox calls never double-submit the same item', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount += 1;
      return new Promise((resolve) =>
        setTimeout(() => resolve({ ok: true, json: async () => ({ _id: 'x' }) }), 20)
      );
    });

    await queueWrite({ method: 'POST', url: '/api/branches', body: { name: 'Test Branch' } });

    await Promise.all([syncOutbox(), syncOutbox()]);

    expect(callCount).toBe(1);
  });

  test('a 4xx response marks the item failed, not synced', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });

    await queueWrite({ method: 'POST', url: '/api/members', body: {} });
    await syncOutbox();

    const status = await getOutboxStatus();
    expect(status.failed).toBe(1);
    expect(status.pending).toBe(0);
  });

  test('regression: a failed item is never retried on a later sync — previously this looped forever', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve({ ok: false, status: 400 });
    });

    await queueWrite({ method: 'POST', url: '/api/members', body: {} });
    await syncOutbox();
    expect(callCount).toBe(1);

    await syncOutbox();
    await syncOutbox();
    expect(callCount).toBe(1);
  });

  test('a 5xx response leaves the item queued for a genuine retry (not marked failed)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await queueWrite({ method: 'POST', url: '/api/members', body: {} });
    await syncOutbox();

    const status = await getOutboxStatus();
    expect(status.pending).toBe(1);
    expect(status.failed).toBe(0);
  });
});
