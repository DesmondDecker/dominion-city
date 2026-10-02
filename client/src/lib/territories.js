import { getDB, queueWrite } from './db';

export async function loadTerritories() {
  const db = await getDB();
  const local = await db.getAll('territories');

  if (navigator.onLine) {
    try {
      const res = await fetch('/api/territories', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('territories', 'readwrite');
        for (const t of fresh) await tx.store.put(t);
        await tx.done;
        return fresh;
      }
    } catch {
      // fall through to local
    }
  }
  return local;
}

export async function createTerritory(payload) {
  const db = await getDB();
  const tempId = `local-${crypto.randomUUID()}`;
  const localRecord = { ...payload, _id: tempId, pendingSync: true };

  await db.put('territories', localRecord);
  await queueWrite({
    method: 'POST',
    url: '/api/territories',
    body: payload,
    localStore: 'territories',
    tempId,
  });

  return localRecord;
}

// Rollup stats are online-only, like the invite flow — this is an
// aggregation query across the whole scope, not something a single
// device's local cache could meaningfully compute offline anyway.
export async function loadTerritoryStats() {
  const res = await fetch('/api/territory-stats', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
  });
  if (!res.ok) return null;
  return res.json();
}
