const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { loadCaseWithAccess } = require('./lib/welfareAccess');
const WelfareDisbursement = require('./models/WelfareDisbursement');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET' && params.caseId) {
      await loadCaseWithAccess(authUser, params.caseId);
      const items = await WelfareDisbursement.find({ case: params.caseId }).sort({ disbursedAt: -1 });
      return { statusCode: 200, body: JSON.stringify(items) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      await loadCaseWithAccess(authUser, payload.case);

      // Idempotent on clientEventId — a retried offline sync never
      // double-records the same disbursement.
      const existing = await WelfareDisbursement.findOne({ clientEventId: payload.clientEventId });
      if (existing) {
        return { statusCode: 200, body: JSON.stringify(existing) };
      }

      const entry = await WelfareDisbursement.create({
        ...payload,
        disbursedBy: authUser.userId,
      });
      return { statusCode: 201, body: JSON.stringify(entry) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('welfare-disbursements error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
