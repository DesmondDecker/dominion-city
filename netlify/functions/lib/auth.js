require('./env');
const jwt = require('jsonwebtoken');

function requireAuth(event) {
  const header = event.headers.authorization || event.headers.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header');
    err.statusCode = 401;
    throw err;
  }
  const token = header.slice('Bearer '.length);
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
    // returns { userId, role, branches, departments }
  } catch (e) {
    const err = new Error('Invalid or expired token');
    err.statusCode = 401;
    throw err;
  }
}

// Throws if the user's scope doesn't include the given branchId,
// unless they're a national_admin (full access).
function assertBranchAccess(authUser, branchId) {
  if (authUser.role === 'national_admin') return;
  const allowed = (authUser.branches || []).map(String).includes(String(branchId));
  if (!allowed) {
    const err = new Error('Not authorized for this branch');
    err.statusCode = 403;
    throw err;
  }
}

// Same idea, for territory-scoped access (a territory_admin overseeing
// a Country/Region rather than a single branch).
function assertTerritoryAccess(authUser, territoryId) {
  if (authUser.role === 'national_admin') return;
  const allowed = (authUser.territories || []).map(String).includes(String(territoryId));
  if (!allowed) {
    const err = new Error('Not authorized for this territory');
    err.statusCode = 403;
    throw err;
  }
}

module.exports = { requireAuth, assertBranchAccess, assertTerritoryAccess };
