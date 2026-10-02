export async function loadAdminStats() {
  const res = await fetch('/api/admin-stats', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
  });
  if (!res.ok) return null;
  return res.json();
}
