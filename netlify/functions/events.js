const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { getChurchId } = require('./lib/church');
const Event = require('./models/Event');

// An event with an empty `branches` array applies to every branch (a
// national event). One with branches set is only visible/editable by
// staff scoped to at least one of those branches — same idea as
// assertBranchAccess, just against an array instead of a single id.
function canAccessEvent(authUser, event) {
  if (authUser.role === 'national_admin') return true;
  if (!event.branches || event.branches.length === 0) return true; // national event, visible to all
  const mine = (authUser.branches || []).map(String);
  return event.branches.some((b) => mine.includes(String(b)));
}

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET' && params.id) {
      const found = await Event.findById(params.id);
      if (!found) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      if (!canAccessEvent(authUser, found)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this event' }) };
      }
      return { statusCode: 200, body: JSON.stringify(found) };
    }

    if (event.httpMethod === 'GET') {
      // Everyone scoped to at least one branch, plus every national
      // (branches-empty) event, plus national admins seeing everything.
      let query = {};
      if (authUser.role !== 'national_admin') {
        query = { $or: [{ branches: { $size: 0 } }, { branches: { $in: authUser.branches || [] } }] };
      }
      if (params.status) query.status = params.status;
      if (!params.includeArchived) query.archivedAt = { $exists: false };

      const events = await Event.find(query).sort({ startsAt: 1 });
      return { statusCode: 200, body: JSON.stringify(events) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.title || !payload.startsAt) {
        return { statusCode: 400, body: JSON.stringify({ error: 'title and startsAt are required' }) };
      }
      if (!payload.church) {
        payload.church = await getChurchId();
      }
      if (authUser.role !== 'national_admin' && payload.branches && payload.branches.length > 0) {
        const mine = (authUser.branches || []).map(String);
        const allowed = payload.branches.every((b) => mine.includes(String(b)));
        if (!allowed) {
          return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for one or more of these branches' }) };
        }
      }
      const created = await Event.create(payload);
      return { statusCode: 201, body: JSON.stringify(created) };
    }

    if (event.httpMethod === 'PATCH' && params.id) {
      const existing = await Event.findById(params.id);
      if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      if (!canAccessEvent(authUser, existing)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this event' }) };
      }

      const updates = JSON.parse(event.body || '{}');
      const allowed = [
        'title', 'description', 'category', 'location', 'coverImageUrl',
        'startsAt', 'endsAt', 'recurrence', 'capacity', 'rsvpDeadline',
        'rsvpVisibility', 'status', 'branches', 'department',
      ];
      const safeUpdates = {};
      for (const key of allowed) if (key in updates) safeUpdates[key] = updates[key];
      if (safeUpdates.status === 'cancelled' || safeUpdates.archived) {
        safeUpdates.archivedAt = new Date();
      }

      const updated = await Event.findByIdAndUpdate(params.id, safeUpdates, { new: true });
      return { statusCode: 200, body: JSON.stringify(updated) };
    }

    if (event.httpMethod === 'DELETE' && params.id) {
      const existing = await Event.findById(params.id);
      if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      if (!canAccessEvent(authUser, existing)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized for this event' }) };
      }
      await Event.findByIdAndDelete(params.id);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('events error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
