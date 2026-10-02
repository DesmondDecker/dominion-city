const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const Event = require('./models/Event');
const EventRSVP = require('./models/EventRSVP');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET' && params.eventId) {
      const rsvps = await EventRSVP.find({ event: params.eventId, status: 'going' }).sort({ createdAt: -1 });
      return { statusCode: 200, body: JSON.stringify(rsvps) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.event) {
        return { statusCode: 400, body: JSON.stringify({ error: 'event is required' }) };
      }
      const found = await Event.findById(payload.event);
      if (!found) return { statusCode: 404, body: JSON.stringify({ error: 'Event not found' }) };

      // Upsert: re-RSVPing (or cancelling) updates the existing record
      // rather than creating duplicates.
      const filter = payload.member
        ? { event: payload.event, member: payload.member }
        : { event: payload.event, guestPhone: payload.guestPhone };

      const rsvp = await EventRSVP.findOneAndUpdate(
        filter,
        {
          event: payload.event,
          member: payload.member || null,
          guestName: payload.guestName,
          guestPhone: payload.guestPhone,
          status: payload.status || 'going',
        },
        { new: true, upsert: true }
      );
      return { statusCode: 201, body: JSON.stringify(rsvp) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('event-rsvps error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
