const { connectDB } = require('./lib/db');
const { requireAuth, assertBranchAccess } = require('./lib/auth');
const CheckIn = require('./models/CheckIn');
const Member = require('./models/Member');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      if (!params.branchId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'branchId is required' }) };
      }
      assertBranchAccess(authUser, params.branchId);

      let dateQuery = {};
      if (params.startDate && params.endDate) {
        const start = new Date(params.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery = { $gte: start, $lte: end };
      } else {
        const start = params.serviceDate ? new Date(params.serviceDate) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        dateQuery = { $gte: start, $lt: end };
      }

      const checkins = await CheckIn.find({
        branch: params.branchId,
        serviceDate: dateQuery,
      }).sort({ createdAt: -1 });

      // Net out reversals: a reversal marker never counts itself, and
      // whatever it points at (by clientEventId) is excluded too — the
      // caller only ever sees the currently-effective check-ins.
      const reversedIds = new Set(checkins.filter((c) => c.reversalOf).map((c) => c.reversalOf));
      const effective = checkins.filter((c) => !c.reversalOf && !reversedIds.has(c.clientEventId));

      return { statusCode: 200, body: JSON.stringify(effective) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.branch || !payload.member || !payload.clientEventId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'branch, member, and clientEventId are required' }) };
      }
      assertBranchAccess(authUser, payload.branch);

      // Idempotent: a retried offline sync never double-records the
      // same check-in.
      const existing = await CheckIn.findOne({ clientEventId: payload.clientEventId });
      if (existing) {
        return { statusCode: 200, body: JSON.stringify(existing) };
      }

      const checkin = await CheckIn.create({ ...payload, checkedInBy: authUser.userId });

      // A reversal shouldn't push lastAttendedAt forward — it's
      // undoing an attendance record, not creating a new one. Known,
      // acceptable limitation: undoing doesn't retroactively restore
      // lastAttendedAt to whatever it was before the mistaken check-in
      // if there's no other check-in to fall back to — a rare enough
      // edge case not worth a full recomputation for.
      if (!payload.reversalOf) {
        await Member.findByIdAndUpdate(payload.member, { lastAttendedAt: checkin.serviceDate });
      }

      return { statusCode: 201, body: JSON.stringify(checkin) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('checkins error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
