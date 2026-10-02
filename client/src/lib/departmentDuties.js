import { getDB, queueWrite } from './db';

export async function loadDuties(departmentId) {
  const db = await getDB();
  const local = (await db.getAll('departmentDuties')).filter((d) => d.department === departmentId);

  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/department-duties?departmentId=${departmentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('departmentDuties', 'readwrite');
        for (const d of fresh) await tx.store.put(d);
        await tx.done;
        return fresh;
      }
    } catch {
      // fall through to local
    }
  }
  return local;
}

export async function scheduleDuty(payload) {
  const db = await getDB();
  const tempId = `local-${crypto.randomUUID()}`;
  const localRecord = { ...payload, _id: tempId };

  await db.put('departmentDuties', localRecord);
  await queueWrite({
    method: 'POST',
    url: '/api/department-duties',
    body: payload,
    localStore: 'departmentDuties',
    tempId,
  });

  return localRecord;
}
