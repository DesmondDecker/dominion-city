// Decodes the JWT payload client-side purely for UI convenience (e.g.
// defaulting a branch picker to the signed-in staff member's branch).
// This is NOT a security check — the server independently verifies the
// token's signature on every request; nothing here should be trusted
// for access control.
export function getCurrentUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded; // { userId, role, branches, departments, exp, iat }
  } catch {
    return null;
  }
}
