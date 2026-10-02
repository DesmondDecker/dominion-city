const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const User = require('./models/User');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      const query = authUser.role === 'national_admin' ? {} : { branches: { $in: authUser.branches || [] } };
      if (params.q) {
        query.name = new RegExp(params.q.trim(), 'i');
      }
      const users = await User.find(query).select('name email role branches').sort({ name: 1 }).limit(100);
      return { statusCode: 200, body: JSON.stringify(users) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('users error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
