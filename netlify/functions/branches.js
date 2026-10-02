const { connectDB } = require('./lib/db');
const { requireAuth, assertBranchAccess } = require('./lib/auth');
const { getChurchId } = require('./lib/church');
const Branch = require('./models/Branch');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      // national_admin sees all branches; everyone else sees only their scope
      const query =
        authUser.role === 'national_admin'
          ? {}
          : { _id: { $in: authUser.branches } };
      const branches = await Branch.find(query).sort({ name: 1 });
      return { statusCode: 200, body: JSON.stringify(branches) };
    }

    if (event.httpMethod === 'POST') {
      // Only national_admin can create a new branch/fellowship
      if (authUser.role !== 'national_admin') {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Only national admins can add a branch or fellowship' }),
        };
      }
      const payload = JSON.parse(event.body || '{}');
      if (!payload.name || !payload.type) {
        return { statusCode: 400, body: JSON.stringify({ error: 'name and type are required' }) };
      }
      if (!payload.church) {
        payload.church = await getChurchId();
      }
      const branch = await Branch.create(payload);
      return { statusCode: 201, body: JSON.stringify(branch) };
    }

    if (event.httpMethod === 'PATCH' && params.id) {
      const existing = await Branch.findById(params.id);
      if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      assertBranchAccess(authUser, existing._id);

      const updates = JSON.parse(event.body || '{}');
      const allowed = [
        'name', 'type', 'address', 'serviceTimes', 'timeZone', 'status',
        'logoUrl', 'brandColors', 'atRiskWeeksThreshold', 'territory',
      ];
      const safeUpdates = {};
      for (const key of allowed) if (key in updates) safeUpdates[key] = updates[key];

      const branch = await Branch.findByIdAndUpdate(params.id, safeUpdates, { new: true });
      return { statusCode: 200, body: JSON.stringify(branch) };
    }

    if (event.httpMethod === 'DELETE' && params.id) {
      if (authUser.role !== 'national_admin') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Only national admins can delete a branch' }) };
      }
      const existing = await Branch.findById(params.id);
      if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      await Branch.findByIdAndDelete(params.id);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('branches error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
