export async function loadChurchId() {
  const cached = localStorage.getItem('churchId');
  if (cached) return cached;

  try {
    const token = localStorage.getItem('token') || '';
    const res = await fetch('/api/church', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const church = await res.json();
    if (!church?._id) return null;

    localStorage.setItem('churchId', church._id);
    return church._id;
  } catch {
    // Genuinely offline or server unreachable — caller handles null
    return null;
  }
}

export async function ensureChurchId() {
  const existing = localStorage.getItem('churchId');
  if (existing) return existing;
  return loadChurchId();
}
