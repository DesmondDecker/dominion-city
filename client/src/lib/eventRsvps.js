import { getDB, queueWrite } from './db';

export async function loadRsvps(eventId) {
  const db = await getDB();
  const local = (await db.getAll('eventRsvps')).filter((r) => r.event === eventId);

  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/event-rsvps?eventId=${eventId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('eventRsvps', 'readwrite');
        for (const r of fresh) await tx.store.put(r);
        await tx.done;
        return fresh;
      }
    } catch {
      // fall through to local
    }
  }
  return local;
}

export async function setRsvp({ event, member, guestName, guestPhone, status }) {
  const db = await getDB();
  const tempId = `local-${crypto.randomUUID()}`;
  const localRecord = { _id: tempId, event, member, guestName, guestPhone, status: status || 'going' };

  await db.put('eventRsvps', localRecord);
  await queueWrite({
    method: 'POST',
    url: '/api/event-rsvps',
    body: { event, member, guestName, guestPhone, status },
    localStore: 'eventRsvps',
    tempId,
  });

  return localRecord;
}
