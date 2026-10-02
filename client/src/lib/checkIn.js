import { getDB, queueWrite } from './db';

// Nets out reversals from a raw list of check-in records: a reversal
// marker never counts itself, and whatever it points at (by
// clientEventId) is excluded too. Shared by both the offline path and
// the merge-with-server path below, so "who's checked in" is always
// computed the same way regardless of connectivity.
function computeEffective(list) {
  const reversedIds = new Set(list.filter((c) => c.reversalOf).map((c) => c.reversalOf));
  return list.filter((c) => !c.reversalOf && !reversedIds.has(c.clientEventId));
}

// Records a check-in immediately in the local store (so the UI updates
// instantly, offline or not), then queues it to sync to the server.
// clientEventId makes this idempotent — retried syncs never double-count.
export async function checkInMember({ branchId, memberId, eventId, checkedInBy, device, visitingFromBranch, serviceDate }) {
  const db = await getDB();
  const clientEventId = crypto.randomUUID();

  const entry = {
    clientEventId,
    branch: branchId,
    member: memberId,
    event: eventId || null,
    serviceDate: serviceDate ? new Date(serviceDate).toISOString() : new Date().toISOString(),
    checkedInBy,
    device,
    visitingFromBranch: visitingFromBranch || null,
    reversalOf: null,
  };

  await db.put('checkins', entry);
  await queueWrite({ method: 'POST', url: '/api/checkins', body: entry });

  return entry;
}

// Undo — never a delete, a reversal record, same reasoning as Welfare
// disbursement corrections. References the original's clientEventId
// rather than requiring it to already have a real server _id, so
// undoing something checked in moments ago (still unsynced) works too.
export async function undoCheckIn({ branchId, memberId, reversalOfClientEventId, checkedInBy, device }) {
  const db = await getDB();
  const clientEventId = crypto.randomUUID();

  const entry = {
    clientEventId,
    branch: branchId,
    member: memberId,
    event: null,
    serviceDate: new Date().toISOString(),
    checkedInBy,
    device,
    reversalOf: reversalOfClientEventId,
  };

  await db.put('checkins', entry);
  await queueWrite({ method: 'POST', url: '/api/checkins', body: entry });

  return entry;
}

// Today's check-ins for a branch — local cache first (works offline),
// refreshed from the server when online. Powers both the running count
// and the "who's already checked in" state in the check-in UI. Always
// returns net-effective entries (reversed ones already excluded).
export async function loadTodayCheckins(branchId) {
  const db = await getDB();
  const todayStr = new Date().toDateString();
  const local = (await db.getAll('checkins')).filter(
    (c) => c.branch === branchId && new Date(c.serviceDate).toDateString() === todayStr
  );

  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/checkins?branchId=${branchId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json(); // already net-effective, server-side
        const tx = db.transaction('checkins', 'readwrite');
        for (const c of fresh) await tx.store.put(c);
        await tx.done;
        // Merge in anything checked in (or undone) locally moments ago
        // that hasn't synced yet, so it doesn't briefly show the wrong
        // state — then net out reversals again, since a pending local
        // reversal might target something the server still shows as
        // active (it doesn't know about the reversal yet).
        const freshIds = new Set(fresh.map((c) => c.clientEventId));
        const stillPending = local.filter((c) => !freshIds.has(c.clientEventId));
        return computeEffective([...stillPending, ...fresh]);
      }
    } catch {
      // fall through to local
    }
  }
  return computeEffective(local);
}

// "Is this member checked in today" — computed from the local log,
// not a stored boolean, and respects reversals the same way.
export async function isCheckedInToday(memberId) {
  const db = await getDB();
  const today = new Date().toDateString();
  const all = (await db.getAll('checkins')).filter((c) => new Date(c.serviceDate).toDateString() === today);
  return computeEffective(all).some((c) => c.member === memberId);
}

export async function loadRangeCheckins(branchId, startDate, endDate) {
  const db = await getDB();
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const local = (await db.getAll('checkins')).filter((c) => {
    if (c.branch !== branchId) return false;
    const d = new Date(c.serviceDate);
    return d >= start && d <= end;
  });

  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/checkins?branchId=${branchId}&startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('checkins', 'readwrite');
        for (const c of fresh) await tx.store.put(c);
        await tx.done;
        const freshIds = new Set(fresh.map((c) => c.clientEventId));
        const stillPending = local.filter((c) => !freshIds.has(c.clientEventId));
        return computeEffective([...stillPending, ...fresh]);
      }
    } catch {
      // fall through
    }
  }
  return computeEffective(local);
}
