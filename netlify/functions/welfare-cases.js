const { connectDB } = require('./lib/db');
const { requireAuth, assertBranchAccess } = require('./lib/auth');
const { loadCaseWithAccess, scopeCaseQuery } = require('./lib/welfareAccess');
const WelfareCase = require('./models/WelfareCase');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const id = event.queryStringParameters && event.queryStringParameters.id;

    if (event.httpMethod === 'GET' && id) {
      // Full detail, including sensitive `details` field — access-gated.
      const kase = await loadCaseWithAccess(authUser, id);
      return { statusCode: 200, body: JSON.stringify(kase) };
    }

    if (event.httpMethod === 'GET') {
      // List view: only fields safe to show in a table — no `details`.
      const cases = await WelfareCase.find(scopeCaseQuery(authUser))
        .select('branch member category priority status summary assignedCaseworker createdAt')
        .sort({ priority: -1, createdAt: -1 });
      return { statusCode: 200, body: JSON.stringify(cases) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.branch) {
        return { statusCode: 400, body: JSON.stringify({ error: 'branch is required' }) };
      }
      assertBranchAccess(authUser, payload.branch);
      const kase = await WelfareCase.create({
        ...payload,
        openedBy: authUser.userId,
      });
      return { statusCode: 201, body: JSON.stringify(kase) };
    }

    if (event.httpMethod === 'PATCH' && id) {
      // Status changes, reassignment, closure — access-gated same as GET detail.
      await loadCaseWithAccess(authUser, id);
      const updates = JSON.parse(event.body || '{}');
      const allowed = ['status', 'priority', 'assignedCaseworker', 'additionalViewers', 'closureReason', 'details'];
      const safeUpdates = {};
      for (const key of allowed) if (key in updates) safeUpdates[key] = updates[key];
      if (safeUpdates.status === 'closed') safeUpdates.closedAt = new Date();

      const kase = await WelfareCase.findByIdAndUpdate(id, safeUpdates, { new: true });
      return { statusCode: 200, body: JSON.stringify(kase) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('welfare-cases error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
