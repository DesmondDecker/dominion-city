export async function loadBranchOverview(branchId) {
  if (!branchId) return null;
  const res = await fetch(`/api/branch-overview?branchId=${branchId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
  });
  if (!res.ok) return null;
  return res.json();
}
