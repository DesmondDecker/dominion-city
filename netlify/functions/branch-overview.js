const { connectDB } = require('./lib/db');
const { requireAuth, assertBranchAccess } = require('./lib/auth');
const Branch = require('./models/Branch');
const Church = require('./models/Church');
const Member = require('./models/Member');
const CheckIn = require('./models/CheckIn');
const Event = require('./models/Event');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (!params.branchId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'branchId is required' }) };
    }
    assertBranchAccess(authUser, params.branchId);

    const branch = await Branch.findById(params.branchId);
    if (!branch) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };

    const church = await Church.findById(branch.church);
    const atRiskWeeks = branch.atRiskWeeksThreshold || church?.defaultSettings?.atRiskWeeksThreshold || 4;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const eightWeeksAgo = new Date(now);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 8 * 7);
    const atRiskCutoff = new Date(now);
    atRiskCutoff.setDate(atRiskCutoff.getDate() - atRiskWeeks * 7);

    const [
      attendanceByWeek,
      firstTimeVisitors,
      newMembersThisMonth,
      needsFollowUp,
      upcomingEvents,
    ] = await Promise.all([
      CheckIn.aggregate([
        { $match: { branch: branch._id, serviceDate: { $gte: eightWeeksAgo } } },
        {
          $group: {
            // Bucket by the Sunday starting each week — %U is
            // week-of-year, good enough as a stable weekly bucket key.
            _id: { $dateToString: { format: '%Y-%U', date: '$serviceDate' } },
            weekStart: { $min: '$serviceDate' },
            count: { $sum: 1 },
          },
        },
        { $sort: { weekStart: 1 } },
      ]),

      // Approximation, worth being explicit about: this counts visitor
      // records created this month, since there's no separate
      // "first visit date" field distinct from the record's creation.
      Member.countDocuments({ branch: branch._id, status: 'visitor', createdAt: { $gte: startOfMonth } }),

      // Same approximation — a member record created this month with
      // status "member" isn't necessarily someone who JUST converted
      // from visitor; it's the closest available signal without a
      // dedicated status-change history.
      Member.countDocuments({ branch: branch._id, status: 'member', createdAt: { $gte: startOfMonth } }),

      // The at-risk computation itself: anyone not a plain visitor
      // whose last recorded check-in is older than the branch's
      // threshold (or who has never checked in at all).
      Member.find({
        branch: branch._id,
        status: { $ne: 'visitor' },
        $or: [{ lastAttendedAt: { $lt: atRiskCutoff } }, { lastAttendedAt: { $exists: false } }],
      })
        .select('firstName lastName lastAttendedAt')
        .sort({ lastAttendedAt: 1 })
        .limit(10),

      Event.find({
        status: 'published',
        startsAt: { $gte: now },
        $or: [{ branches: { $size: 0 } }, { branches: branch._id }],
      })
        .select('title startsAt location')
        .sort({ startsAt: 1 })
        .limit(3),
    ]);

    const weeksAbsent = (lastAttendedAt) =>
      lastAttendedAt ? Math.floor((now - new Date(lastAttendedAt)) / (7 * 24 * 60 * 60 * 1000)) : null;

    return {
      statusCode: 200,
      body: JSON.stringify({
        branchName: branch.name,
        asOf: now.toISOString(),
        attendance: attendanceByWeek.map((w) => ({ week: w.weekStart, count: w.count })),
        firstTimeVisitors,
        newMembersThisMonth,
        needsFollowUp: needsFollowUp.map((m) => ({
          id: m._id,
          name: `${m.firstName} ${m.lastName}`,
          weeksAbsent: weeksAbsent(m.lastAttendedAt),
        })),
        upcomingEvents: upcomingEvents.map((e) => ({ id: e._id, title: e.title, startsAt: e.startsAt, location: e.location })),
      }),
    };
  } catch (err) {
    if (!err.statusCode) console.error('branch-overview error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
