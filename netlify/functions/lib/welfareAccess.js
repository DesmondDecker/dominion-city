const WelfareCase = require('../models/WelfareCase');

// A user can see a welfare case at all if they're a national admin, the
// branch admin for that case's branch, the assigned caseworker, or an
// explicitly added additional viewer. Everyone else gets a 404, not a
// 403 — we don't want to confirm a case even exists to someone unauthorized.
async function loadCaseWithAccess(authUser, caseId) {
  const kase = await WelfareCase.findById(caseId);
  if (!kase) {
    const err = new Error('Not found');
    err.statusCode = 404;
    throw err;
  }

  const isNationalAdmin = authUser.role === 'national_admin';
  const isBranchScopedAdmin =
    ['branch_admin', 'fellowship_leader'].includes(authUser.role) &&
    (authUser.branches || []).map(String).includes(String(kase.branch));
  const isCaseworker = String(kase.assignedCaseworker) === String(authUser.userId);
  const isAdditionalViewer = (kase.additionalViewers || [])
    .map(String)
    .includes(String(authUser.userId));

  if (!(isNationalAdmin || isBranchScopedAdmin || isCaseworker || isAdditionalViewer)) {
    const err = new Error('Not found');
    err.statusCode = 404;
    throw err;
  }

  return kase;
}

// For list views: which cases is this user allowed to see at all.
// Branch Admins and Fellowship Leaders see their branch's/fellowship's
// cases; caseworkers see cases assigned to them; national admins see
// everything.
function scopeCaseQuery(authUser) {
  if (authUser.role === 'national_admin') return {};
  if (['branch_admin', 'fellowship_leader'].includes(authUser.role)) {
    return { branch: { $in: authUser.branches } };
  }
  return {
    $or: [
      { assignedCaseworker: authUser.userId },
      { additionalViewers: authUser.userId },
    ],
  };
}

module.exports = { loadCaseWithAccess, scopeCaseQuery };
