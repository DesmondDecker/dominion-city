const { connectDB } = require('./lib/db');
const { requireAuth, assertTerritoryAccess } = require('./lib/auth');
const { getChurchId } = require('./lib/church');
const Territory = require('./models/Territory');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET' && params.id) {
      const territory = await Territory.findById(params.id);
      if (!territory) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      return { statusCode: 200, body: JSON.stringify(territory) };
    }

    if (event.httpMethod === 'GET') {
      // The whole tree is returned flat — small dataset (continents/
      // countries/regions, not branches), client builds the hierarchy
      // from parentTerritory.
      const query =
        authUser.role === 'national_admin' ? {} : { _id: { $in: authUser.territories || [] } };
      const territories = await Territory.find(query).sort({ type: 1, name: 1 });
      return { statusCode: 200, body: JSON.stringify(territories) };
    }

    if (event.httpMethod === 'POST') {
      if (authUser.role !== 'national_admin') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Only a national admin can add a territory' }) };
      }
      const payload = JSON.parse(event.body || '{}');
      if (!payload.name || !payload.type) {
        return { statusCode: 400, body: JSON.stringify({ error: 'name and type are required' }) };
      }
      if (!payload.church) {
        payload.church = await getChurchId();
      }
      const territory = await Territory.create(payload);
      return { statusCode: 201, body: JSON.stringify(territory) };
    }

    if (event.httpMethod === 'PATCH' && params.id) {
      if (authUser.role !== 'national_admin') {
        assertTerritoryAccess(authUser, params.id);
      }
      const updates = JSON.parse(event.body || '{}');
      const allowed = ['name', 'parentTerritory', 'territoryAdmins'];
      const safeUpdates = {};
      for (const key of allowed) if (key in updates) safeUpdates[key] = updates[key];

      const territory = await Territory.findByIdAndUpdate(params.id, safeUpdates, { new: true });
      return { statusCode: 200, body: JSON.stringify(territory) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('territories error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
