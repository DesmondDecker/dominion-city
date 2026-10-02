const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { loadCaseWithAccess } = require('./lib/welfareAccess');
const WelfareRequest = require('./models/WelfareRequest');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET' && params.caseId) {
      await loadCaseWithAccess(authUser, params.caseId); // confirms viewer is authorized
      const requests = await WelfareRequest.find({ case: params.caseId }).sort({ createdAt: -1 });
      return { statusCode: 200, body: JSON.stringify(requests) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.case || !payload.type) {
        return { statusCode: 400, body: JSON.stringify({ error: 'case and type are required' }) };
      }
      await loadCaseWithAccess(authUser, payload.case);
      const request = await WelfareRequest.create(payload);
      return { statusCode: 201, body: JSON.stringify(request) };
    }

    if (event.httpMethod === 'PATCH' && params.id) {
      // Approve/decline. Only an admin scoped to *this case's* branch can
      // decide — a global branch_admin role isn't enough on its own,
      // since that could let a branch admin approve another branch's
      // request. A caseworker can raise a request but shouldn't approve
      // their own ask.
      const existingRequest = await WelfareRequest.findById(params.id);
      if (!existingRequest) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      }
      const kase = await loadCaseWithAccess(authUser, existingRequest.case);
      if (!['branch_admin', 'national_admin'].includes(authUser.role)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Only an admin can decide on a welfare request' }) };
      }
      if (authUser.role === 'branch_admin' && !(authUser.branches || []).map(String).includes(String(kase.branch))) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this branch' }) };
      }

      const updates = JSON.parse(event.body || '{}');
      const request = await WelfareRequest.findByIdAndUpdate(
        params.id,
        {
          status: updates.status,
          decisionNote: updates.decisionNote,
          decidedBy: authUser.userId,
          decidedAt: new Date(),
        },
        { new: true }
      );
      return { statusCode: 200, body: JSON.stringify(request) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('welfare-requests error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
