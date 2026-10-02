import { getDB, queueWrite } from './db';

// Converting a contact into a real Member record links two documents
// by their actual server _id, so — unlike everything else in this
// file — this is deliberately online-only rather than routed through
// the offline queue. Chaining two offline-optimistic creates (a temp
// member id referencing a temp contact id) would be fragile, not
// genuinely offline-safe; better to be honest that this one action
// needs a connection, same choice already made for staff invites.
export async function convertContactToMember(contact, branchId) {
  if (!navigator.onLine) {
    throw new Error("You're offline — converting a contact needs a connection.");
  }
  const token = localStorage.getItem('token') || '';
  const [firstName, ...rest] = (contact.name || 'Unknown').split(' ');

  const memberRes = await fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      branch: branchId,
      firstName: firstName || 'Unknown',
      lastName: rest.join(' ') || '-',
      phone: contact.phone,
      status: 'visitor',
    }),
  });
  const member = await memberRes.json();
  if (!memberRes.ok) throw new Error(member.error || 'Could not create the member record');

  const contactRes = await fetch(`/api/evangelism-contacts?id=${contact._id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ convertedMember: member._id }),
  });
  if (!contactRes.ok) {
    const err = await contactRes.json();
    throw new Error(err.error || 'Member was created, but the contact record could not be linked to it');
  }

  // Keep the local caches in sync so the UI reflects this immediately.
  const db = await getDB();
  await db.put('members', member);
  const localContact = await db.get('evangelismContacts', contact.clientEventId);
  if (localContact) await db.put('evangelismContacts', { ...localContact, convertedMember: member._id });

  return member;
}

export async function logContact({ departmentId, name, phone, location, outcome, followUpNeeded, notes }) {
  const db = await getDB();
  const clientEventId = crypto.randomUUID();

  const entry = {
    clientEventId,
    department: departmentId,
    contactedAt: new Date().toISOString(),
    name,
    phone,
    location,
    outcome: outcome || 'interested',
    followUpNeeded: followUpNeeded !== false,
    notes,
  };

  await db.put('evangelismContacts', entry);
  await queueWrite({ method: 'POST', url: '/api/evangelism-contacts', body: entry });

  return entry;
}

export async function loadContacts(departmentId) {
  const db = await getDB();
  const local = (await db.getAll('evangelismContacts')).filter((c) => c.department === departmentId);

  if (navigator.onLine) {
    try {
      const res = await fetch(`/api/evangelism-contacts?departmentId=${departmentId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        const tx = db.transaction('evangelismContacts', 'readwrite');
        for (const c of fresh) await tx.store.put(c);
        await tx.done;
        const freshIds = new Set(fresh.map((c) => c.clientEventId));
        const stillPending = local.filter((c) => !freshIds.has(c.clientEventId));
        return [...stillPending, ...fresh];
      }
    } catch {
      // fall through to local
    }
  }
  return local;
}
