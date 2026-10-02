import { getDB, queueWrite } from './db';

export async function loadBranches() {
  const db = await getDB();
  let local = await db.getAll('branches');

  if (navigator.onLine) {
    try {
      const res = await fetch('/api/branches', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('branches', 'readwrite');
        await tx.store.clear();
        for (const b of fresh) await tx.store.put(b);
        await tx.done;
        return fresh;
      }
    } catch {
      // fall through to local
    }
  }

  return local.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function createBranch(payload) {
  const db = await getDB();
  const tempId = `local-${crypto.randomUUID()}`;
  const localRecord = { ...payload, _id: tempId, pendingSync: true };

  await db.put('branches', localRecord);
  await queueWrite({
    method: 'POST',
    url: '/api/branches',
    body: payload,
    localStore: 'branches',
    tempId,
  });

  return localRecord;
}

export async function updateBranch(id, updates) {
  const db = await getDB();
  const existing = await db.get('branches', id);
  if (existing) await db.put('branches', { ...existing, ...updates });

  await queueWrite({ method: 'PATCH', url: `/api/branches?id=${id}`, body: updates });
}

export async function deleteBranch(id) {
  const db = await getDB();
  await db.delete('branches', id);

  await queueWrite({ method: 'DELETE', url: `/api/branches?id=${id}` });
}

