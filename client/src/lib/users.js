import { getDB } from './db';

export async function loadUsers({ q } = {}) {
  const db = await getDB();
  const local = await db.getAll('users');

  if (navigator.onLine) {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const res = await fetch(`/api/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('users', 'readwrite');
        for (const u of fresh) await tx.store.put(u);
        await tx.done;
        return fresh;
      }
    } catch {
      // fall through to local
    }
  }

  if (!q) return local;
  const needle = q.trim().toLowerCase();
  return local.filter((u) => u.name.toLowerCase().includes(needle));
}

export async function getUser(id) {
  const db = await getDB();
  return db.get('users', id);
}
