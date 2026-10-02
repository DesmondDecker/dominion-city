const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const Department = require('./models/Department');
const DepartmentDuty = require('./models/DepartmentDuty');

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
      const duties = await DepartmentDuty.find({ department: params.departmentId }).sort({ dutyDate: 1 });
      return { statusCode: 200, body: JSON.stringify(duties) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.department || !payload.member || !payload.dutyDate) {
        return { statusCode: 400, body: JSON.stringify({ error: 'department, member, and dutyDate are required' }) };
      }
      const dept = await Department.findById(payload.department);
      if (!dept) return { statusCode: 404, body: JSON.stringify({ error: 'Department not found' }) };
      if (!canAccessDepartment(authUser, dept)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this department' }) };
      }
      const duty = await DepartmentDuty.create({ ...payload, assignedBy: authUser.userId });
      return { statusCode: 201, body: JSON.stringify(duty) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('department-duties error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
