const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { getOrCreateChurch } = require('./lib/church');
const Church = require('./models/Church');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);

    if (event.httpMethod === 'GET') {
      const church = await getOrCreateChurch();
      return { statusCode: 200, body: JSON.stringify(church) };
    }

    if (event.httpMethod === 'PATCH') {
      if (authUser.role !== 'national_admin') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Only a national admin can update church settings' }) };
      }
      const church = await getOrCreateChurch();
      const updates = JSON.parse(event.body || '{}');
      const allowed = ['name', 'logoUrl', 'faviconUrl', 'brandColors', 'defaultSettings', 'funds', 'eventCategories'];
      const safeUpdates = {};
      for (const key of allowed) if (key in updates) safeUpdates[key] = updates[key];

      const updated = await Church.findByIdAndUpdate(church._id, safeUpdates, { new: true });
      return { statusCode: 200, body: JSON.stringify(updated) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('church error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
