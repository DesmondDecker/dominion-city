const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const Branch = require('./models/Branch');
const Territory = require('./models/Territory');
const Member = require('./models/Member');
const CheckIn = require('./models/CheckIn');
const Event = require('./models/Event');
const EventRSVP = require('./models/EventRSVP');
const Department = require('./models/Department');
const WelfareCase = require('./models/WelfareCase');
const User = require('./models/User');
const StaffInvite = require('./models/StaffInvite');

const ADMIN_ROLES = ['national_admin', 'territory_admin', 'branch_admin'];

// Welfare only ever returns COUNTS by status here, never case details or
// summaries — this is an aggregate KPI, not a case list. It never shows
// anything beyond what an admin could already see by querying Welfare
// itself (same branch scoping as welfareAccess.js's scopeCaseQuery).
exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);

    if (!ADMIN_ROLES.includes(authUser.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin dashboard access requires an admin role' }) };
    }

    const isNational = authUser.role === 'national_admin';
    const branchQuery = isNational ? {} : { _id: { $in: authUser.branches || [] } };
    const branches = await Branch.find(branchQuery).select('_id');
    const branchIds = branches.map((b) => b._id);

    const start7 = new Date();
    start7.setHours(0, 0, 0, 0);
    start7.setDate(start7.getDate() - 6); // last 7 days including today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      territoryCount,
      memberStatusCounts,
      checkinTrend,
      checkedInToday,
      upcomingEvents,
      eventRsvpTotal,
      departmentCount,
      welfareStatusCounts,
      staffRoleCounts,
      pendingInviteCount,
    ] = await Promise.all([
      isNational ? Territory.countDocuments({}) : Territory.countDocuments({ _id: { $in: authUser.territories || [] } }),

      Member.aggregate([
        { $match: { branch: { $in: branchIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      CheckIn.aggregate([
        { $match: { branch: { $in: branchIds }, serviceDate: { $gte: start7 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$serviceDate' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      CheckIn.countDocuments({ branch: { $in: branchIds }, serviceDate: { $gte: todayStart, $lt: todayEnd } }),

      Event.countDocuments({
        status: 'published',
        startsAt: { $gte: new Date() },
        ...(isNational ? {} : { $or: [{ branches: { $size: 0 } }, { branches: { $in: branchIds } }] }),
      }),

      (async () => {
        const upcoming = await Event.find({
          status: 'published',
          startsAt: { $gte: new Date() },
          ...(isNational ? {} : { $or: [{ branches: { $size: 0 } }, { branches: { $in: branchIds } }] }),
        }).select('_id');
        return EventRSVP.countDocuments({ event: { $in: upcoming.map((e) => e._id) }, status: 'going' });
      })(),

      isNational
        ? Department.countDocuments({})
        : Department.countDocuments({ $or: [{ scope: 'national' }, { branch: { $in: branchIds } }] }),

      WelfareCase.aggregate([
        { $match: isNational ? {} : { branch: { $in: branchIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      User.aggregate([
        { $match: isNational ? {} : { branches: { $in: branchIds } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),

      StaffInvite.countDocuments({
        acceptedAt: { $exists: false },
        ...(isNational ? {} : { branches: { $in: branchIds } }),
      }),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        asOf: new Date().toISOString(),
        scope: isNational ? 'national' : 'scoped',
        branchCount: branchIds.length,
        territoryCount,
        members: {
          total: memberStatusCounts.reduce((sum, m) => sum + m.count, 0),
          byStatus: Object.fromEntries(memberStatusCounts.map((m) => [m._id, m.count])),
        },
        checkins: {
          today: checkedInToday,
          last7Days: checkinTrend.map((d) => ({ date: d._id, count: d.count })),
        },
        events: {
          upcoming: upcomingEvents,
          totalRsvps: eventRsvpTotal,
        },
        departmentCount,
        welfare: {
          byStatus: Object.fromEntries(welfareStatusCounts.map((w) => [w._id, w.count])),
        },
        staff: {
          byRole: Object.fromEntries(staffRoleCounts.map((s) => [s._id, s.count])),
          pendingInvites: pendingInviteCount,
        },
      }),
    };
  } catch (err) {
    if (!err.statusCode) console.error('admin-stats error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
