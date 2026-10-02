import { getDB, queueWrite } from './db';

// Read local cache first, refresh from server when online. `q` filters
// client-side against the cache too, so search still works offline.
export async function loadMembers({ q, status } = {}) {
  const db = await getDB();
  let local = await db.getAll('members');

  if (navigator.onLine) {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      const res = await fetch(`/api/members?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('members', 'readwrite');
        for (const m of fresh) await tx.store.put(m);
        await tx.done;
        return fresh;
      }
    } catch {
      // fall through to local
    }
  }

  return filterLocal(local, { q, status });
}

function filterLocal(members, { q, status }) {
  let result = members;
  if (status) result = result.filter((m) => m.status === status);
  if (q) {
    const needle = q.trim().toLowerCase();
    result = result.filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(needle) ||
        (m.phone || '').includes(needle)
    );
  }
  return result;
}

// Create a member offline-safely: shows up in the UI instantly under a
// temp id, then gets swapped for the real server record once it syncs
// (handled generically by syncOutbox's reconciliation logic in db.js).
export async function createMember(payload) {
  const db = await getDB();
  const tempId = `local-${crypto.randomUUID()}`;
  const localRecord = { ...payload, _id: tempId, pendingSync: true };

  await db.put('members', localRecord);
  await queueWrite({
    method: 'POST',
    url: '/api/members',
    body: payload,
    localStore: 'members',
    tempId,
  });

  return localRecord;
}

export async function updateMember(id, updates) {
  const db = await getDB();
  const existing = await db.get('members', id);
  if (existing) await db.put('members', { ...existing, ...updates });

  await queueWrite({ method: 'PATCH', url: `/api/members?id=${id}`, body: updates });
}

export async function deleteMember(id) {
  const db = await getDB();
  await db.delete('members', id);

  await queueWrite({ method: 'DELETE', url: `/api/members?id=${id}` });
}

export async function getMember(id) {
  const db = await getDB();
  const local = await db.get('members', id);
  if (local) return local;

  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/members?id=${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const member = await res.json();
        await db.put('members', member);
        return member;
      }
    } catch {
      // no local copy and can't reach the server
    }
  }
  return null;
}
