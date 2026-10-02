import { getDB, queueWrite } from './db';

export async function markPresent({ departmentId, memberId, markedBy }) {
  const db = await getDB();
  const clientEventId = crypto.randomUUID();

  const entry = {
    clientEventId,
    department: departmentId,
    member: memberId,
    meetingDate: new Date().toISOString(),
    markedBy,
  };

  await db.put('departmentAttendance', entry);
  await queueWrite({ method: 'POST', url: '/api/department-attendance', body: entry });

  return entry;
}

export async function loadTodayAttendance(departmentId) {
  const db = await getDB();
  const todayStr = new Date().toDateString();
  const local = (await db.getAll('departmentAttendance')).filter(
    (a) => a.department === departmentId && new Date(a.meetingDate).toDateString() === todayStr
  );

  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/department-attendance?departmentId=${departmentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('departmentAttendance', 'readwrite');
        for (const a of fresh) await tx.store.put(a);
        await tx.done;
        const freshIds = new Set(fresh.map((a) => a.clientEventId));
        const stillPending = local.filter((a) => !freshIds.has(a.clientEventId));
        return [...stillPending, ...fresh];
      }
    } catch {
      // fall through to local
    }
  }
  return local;
}
