const { connectDB } = require('./lib/db');
const { requireAuth, assertBranchAccess } = require('./lib/auth');
const { getChurchId } = require('./lib/church');
const Department = require('./models/Department');

function canAccessDepartment(authUser, dept) {
  if (authUser.role === 'national_admin') return true;
  if (dept.scope === 'national') return true;
  const mine = (authUser.branches || []).map(String);
  return dept.branch && mine.includes(String(dept.branch));
}

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET' && params.id) {
      const dept = await Department.findById(params.id);
      if (!dept) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      if (!canAccessDepartment(authUser, dept)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this department' }) };
      }
      return { statusCode: 200, body: JSON.stringify(dept) };
    }

    if (event.httpMethod === 'GET') {
      const query =
        authUser.role === 'national_admin'
          ? {}
          : { $or: [{ scope: 'national' }, { branch: { $in: authUser.branches || [] } }] };
      const departments = await Department.find(query).sort({ name: 1 });
      return { statusCode: 200, body: JSON.stringify(departments) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.name) {
        return { statusCode: 400, body: JSON.stringify({ error: 'name is required' }) };
      }
      if (!payload.church) {
        payload.church = await getChurchId();
      }
      if (payload.scope === 'national' && authUser.role !== 'national_admin') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Only a national admin can create a national department' }) };
      }
      if (payload.scope !== 'national') {
        if (!payload.branch) {
          return { statusCode: 400, body: JSON.stringify({ error: 'branch is required for a branch-scoped department' }) };
        }
        assertBranchAccess(authUser, payload.branch);
      }
      const dept = await Department.create(payload);
      return { statusCode: 201, body: JSON.stringify(dept) };
    }

    if (event.httpMethod === 'PATCH' && params.id) {
      const existing = await Department.findById(params.id);
      if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      if (!canAccessDepartment(authUser, existing)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this department' }) };
      }
      const updates = JSON.parse(event.body || '{}');
      const allowed = ['name', 'description', 'headUser', 'defaultMeeting', 'joinPolicy', 'parentDepartment', 'trackOutreachContacts'];
      const safeUpdates = {};
      for (const key of allowed) if (key in updates) safeUpdates[key] = updates[key];

      const dept = await Department.findByIdAndUpdate(params.id, safeUpdates, { new: true });
      return { statusCode: 200, body: JSON.stringify(dept) };
    }

    if (event.httpMethod === 'DELETE' && params.id) {
      const existing = await Department.findById(params.id);
      if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      if (!canAccessDepartment(authUser, existing)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this department' }) };
      }
      await Department.findByIdAndDelete(params.id);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('departments error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
