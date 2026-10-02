const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const Department = require('./models/Department');
const DepartmentAttendance = require('./models/DepartmentAttendance');

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

      let dateQuery = {};
      if (params.startDate && params.endDate) {
        const start = new Date(params.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery = { $gte: start, $lte: end };
      } else {
        const start = params.meetingDate ? new Date(params.meetingDate) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        dateQuery = { $gte: start, $lt: end };
      }

      const records = await DepartmentAttendance.find({
        department: params.departmentId,
        meetingDate: dateQuery,
      }).sort({ createdAt: -1 });
      return { statusCode: 200, body: JSON.stringify(records) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.department || !payload.member || !payload.clientEventId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'department, member, and clientEventId are required' }) };
      }
      const dept = await Department.findById(payload.department);
      if (!dept) return { statusCode: 404, body: JSON.stringify({ error: 'Department not found' }) };
      if (!canAccessDepartment(authUser, dept)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this department' }) };
      }

      const existing = await DepartmentAttendance.findOne({ clientEventId: payload.clientEventId });
      if (existing) {
        return { statusCode: 200, body: JSON.stringify(existing) };
      }

      const record = await DepartmentAttendance.create({ ...payload, markedBy: authUser.userId });
      return { statusCode: 201, body: JSON.stringify(record) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('department-attendance error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
