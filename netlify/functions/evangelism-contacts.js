const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const Department = require('./models/Department');
const EvangelismContact = require('./models/EvangelismContact');

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

    if (event.httpMethod === 'GET' && params.departmentId) {
      const dept = await Department.findById(params.departmentId);
      if (!dept) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      if (!canAccessDepartment(authUser, dept)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this department' }) };
      }
      const contacts = await EvangelismContact.find({ department: params.departmentId }).sort({ contactedAt: -1 });
      return { statusCode: 200, body: JSON.stringify(contacts) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.department || !payload.clientEventId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'department and clientEventId are required' }) };
      }
      const dept = await Department.findById(payload.department);
      if (!dept) return { statusCode: 404, body: JSON.stringify({ error: 'Department not found' }) };
      if (!canAccessDepartment(authUser, dept)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this department' }) };
      }

      const existing = await EvangelismContact.findOne({ clientEventId: payload.clientEventId });
      if (existing) {
        return { statusCode: 200, body: JSON.stringify(existing) };
      }

      const contact = await EvangelismContact.create({ ...payload, contactedBy: authUser.userId });
      return { statusCode: 201, body: JSON.stringify(contact) };
    }

    if (event.httpMethod === 'PATCH' && params.id) {
      const contact = await EvangelismContact.findById(params.id);
      if (!contact) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      const dept = await Department.findById(contact.department);
      if (!dept || !canAccessDepartment(authUser, dept)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this department' }) };
      }

      const updates = JSON.parse(event.body || '{}');
      const allowed = ['convertedMember', 'followUpNeeded', 'followUpDate', 'notes', 'outcome'];
      const safeUpdates = {};
      for (const key of allowed) if (key in updates) safeUpdates[key] = updates[key];

      const updated = await EvangelismContact.findByIdAndUpdate(params.id, safeUpdates, { new: true });
      return { statusCode: 200, body: JSON.stringify(updated) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('evangelism-contacts error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
