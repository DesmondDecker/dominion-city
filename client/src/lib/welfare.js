import { getDB, queueWrite } from './db';

// Cases: read local cache first, refresh from server when online.
export async function loadCases() {
  const db = await getDB();
  const local = await db.getAll('welfareCases');

  if (navigator.onLine) {
    try {
      const res = await fetch('/api/welfare-cases', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const fresh = await res.json();
      const tx = db.transaction('welfareCases', 'readwrite');
      for (const c of fresh) await tx.store.put(c);
      await tx.done;

      // A case created offline moments ago may not have synced yet —
      // don't let it disappear from the list until it does.
      const stillPending = local.filter((c) => c.pendingSync && String(c._id).startsWith('local-'));
      return [...stillPending, ...fresh];
    } catch {
      return local;
    }
  }
  return local;
}

// Creating a case offline needs to be visible immediately — this is the
// module where speed matters most (a caseworker opening a case with no
// signal). Same temp-id + reconciliation pattern as createMember.
export async function createCase(payload) {
  const db = await getDB();
  const tempId = `local-${crypto.randomUUID()}`;
  const localRecord = { ...payload, _id: tempId, pendingSync: true };

  await db.put('welfareCases', localRecord);
  await queueWrite({
    method: 'POST',
    url: '/api/welfare-cases',
    body: payload,
    localStore: 'welfareCases',
    tempId,
  });

  return localRecord;
}

// Disbursements and visits: append-only, offline-first, same pattern as
// checkIn.js — write locally + to the outbox immediately, never wait
// on the network, never risk a lost record.
export async function recordDisbursement(payload) {
  const db = await getDB();
  const clientEventId = crypto.randomUUID();
  const entry = { ...payload, clientEventId, disbursedAt: new Date().toISOString() };

  await db.put('welfareDisbursements', entry);
  await queueWrite({ method: 'POST', url: '/api/welfare-disbursements', body: entry });
  return entry;
}

export async function logVisit(payload) {
  const db = await getDB();
  const clientEventId = crypto.randomUUID();
  const entry = { ...payload, clientEventId, visitDate: payload.visitDate || new Date().toISOString() };

  await db.put('welfareVisits', entry);
  await queueWrite({ method: 'POST', url: '/api/welfare-visits', body: entry });
  return entry;
}
