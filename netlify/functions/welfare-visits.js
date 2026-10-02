const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { loadCaseWithAccess } = require('./lib/welfareAccess');
const WelfareVisit = require('./models/WelfareVisit');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET' && params.caseId) {
      await loadCaseWithAccess(authUser, params.caseId);
      const visits = await WelfareVisit.find({ case: params.caseId }).sort({ visitDate: -1 });
      return { statusCode: 200, body: JSON.stringify(visits) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      await loadCaseWithAccess(authUser, payload.case);

      const existing = await WelfareVisit.findOne({ clientEventId: payload.clientEventId });
      if (existing) {
        return { statusCode: 200, body: JSON.stringify(existing) };
      }

      const visit = await WelfareVisit.create({ ...payload, visitedBy: authUser.userId });
      return { statusCode: 201, body: JSON.stringify(visit) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('welfare-visits error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
