// Unlike the rest of the app, invite creation is not offline-first —
// it has to actually reach the server to send an email, so there's no
// meaningful "instant local" version of this action. If offline, the
// caller should tell the admin to try again once connected, rather
// than queuing it silently and having them think it worked.

export async function loadInvites() {
  const res = await fetch('/api/staff-invites', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function sendInvite(payload) {
  const res = await fetch('/api/staff-invites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send invite');
  return data; // { invite, emailStatus, acceptUrl }
}
