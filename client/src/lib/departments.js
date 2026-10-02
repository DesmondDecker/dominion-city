import { getDB, queueWrite } from './db';
import { getMember, updateMember } from './members';

export async function loadDepartments() {
  const db = await getDB();
  const local = await db.getAll('departments');

  if (navigator.onLine) {
    try {
      const res = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('departments', 'readwrite');
        for (const d of fresh) await tx.store.put(d);
        await tx.done;
        const stillPending = local.filter((d) => d.pendingSync && String(d._id).startsWith('local-'));
        return [...stillPending, ...fresh];
      }
    } catch {
      // fall through to local
    }
  }
  return local;
}

export async function getDepartment(id) {
  const db = await getDB();
  const local = await db.get('departments', id);
  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/departments?id=${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        await db.put('departments', fresh);
        return fresh;
      }
    } catch {
      // fall through
    }
  }
  return local || null;
}

export async function createDepartment(payload) {
  const db = await getDB();
  const tempId = `local-${crypto.randomUUID()}`;
  const localRecord = { ...payload, _id: tempId, pendingSync: true };

  await db.put('departments', localRecord);
  await queueWrite({
    method: 'POST',
    url: '/api/departments',
    body: payload,
    localStore: 'departments',
    tempId,
  });

  return localRecord;
}

export async function updateDepartment(id, updates) {
  const db = await getDB();
  const existing = await db.get('departments', id);
  if (existing) await db.put('departments', { ...existing, ...updates });

  await queueWrite({ method: 'PATCH', url: `/api/departments?id=${id}`, body: updates });
}

export async function deleteDepartment(id) {
  const db = await getDB();
  await db.delete('departments', id);

  await queueWrite({ method: 'DELETE', url: `/api/departments?id=${id}` });
}

// Roster: adding/removing a member is really an edit to Member.departments,
// so this reuses the member helpers rather than duplicating the pattern.
export async function addToRoster(memberId, departmentId) {
  const member = await getMember(memberId);
  if (!member) return;
  const current = member.departments || [];
  if (current.includes(departmentId)) return;
  await updateMember(memberId, { departments: [...current, departmentId] });
}

export async function removeFromRoster(memberId, departmentId) {
  const member = await getMember(memberId);
  if (!member) return;
  const current = member.departments || [];
  await updateMember(memberId, { departments: current.filter((d) => d !== departmentId) });
}
