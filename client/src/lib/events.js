import { getDB, queueWrite } from './db';

export async function loadEvents({ status } = {}) {
  const db = await getDB();
  const local = await db.getAll('events');

  if (navigator.onLine) {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const res = await fetch(`/api/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('events', 'readwrite');
        for (const e of fresh) await tx.store.put(e);
        await tx.done;

        const stillPending = local.filter((e) => e.pendingSync && String(e._id).startsWith('local-'));
        return [...stillPending, ...fresh];
      }
    } catch {
      // fall through to local
    }
  }

  return status ? local.filter((e) => e.status === status) : local;
}

export async function getEvent(id) {
  const db = await getDB();
  const local = await db.get('events', id);
  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/events?id=${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        await db.put('events', fresh);
        return fresh;
      }
    } catch {
      // fall through to local
    }
  }
  return local || null;
}

// Same offline-safe pattern as createMember/createCase: shows up
// instantly under a temp id, swapped for the real record on sync.
export async function createEvent(payload) {
  const db = await getDB();
  const tempId = `local-${crypto.randomUUID()}`;
  const localRecord = { ...payload, _id: tempId, status: payload.status || 'draft', pendingSync: true };

  await db.put('events', localRecord);
  await queueWrite({
    method: 'POST',
    url: '/api/events',
    body: payload,
    localStore: 'events',
    tempId,
  });

  return localRecord;
}

export async function updateEvent(id, updates) {
  const db = await getDB();
  const existing = await db.get('events', id);
  if (existing) await db.put('events', { ...existing, ...updates });

  await queueWrite({ method: 'PATCH', url: `/api/events?id=${id}`, body: updates });
}

export async function deleteEvent(id) {
  const db = await getDB();
  await db.delete('events', id);

  await queueWrite({ method: 'DELETE', url: `/api/events?id=${id}` });
}
