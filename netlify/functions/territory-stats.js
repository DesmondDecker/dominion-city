const { connectDB } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const Branch = require('./models/Branch');
const Member = require('./models/Member');
const CheckIn = require('./models/CheckIn');

// Deliberately limited to what's actually measurable right now
// (member/branch/today's-checkin counts) — no at-risk numbers, since
// that engine doesn't exist yet and faking it would be worse than not
// showing it.
exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);

    if (!['national_admin', 'territory_admin', 'branch_admin'].includes(authUser.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Requires an admin role' }) };
    }
    const branchQuery = authUser.role === 'national_admin' ? {} : { _id: { $in: authUser.branches || [] } };
    const branches = await Branch.find(branchQuery).select('name territory type');

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    // One query each, not N+1 per branch — aggregate then map back.
    const memberCounts = await Member.aggregate([
      { $match: { branch: { $in: branches.map((b) => b._id) } } },
      { $group: { _id: '$branch', count: { $sum: 1 } } },
    ]);
    const checkinCounts = await CheckIn.aggregate([
      { $match: { branch: { $in: branches.map((b) => b._id) }, serviceDate: { $gte: start, $lt: end } } },
      { $group: { _id: '$branch', count: { $sum: 1 } } },
    ]);

    const memberMap = Object.fromEntries(memberCounts.map((m) => [String(m._id), m.count]));
    const checkinMap = Object.fromEntries(checkinCounts.map((c) => [String(c._id), c.count]));

    const perBranch = branches.map((b) => ({
      branchId: b._id,
      branchName: b.name,
      territory: b.territory,
      members: memberMap[String(b._id)] || 0,
      checkedInToday: checkinMap[String(b._id)] || 0,
    }));

    return { statusCode: 200, body: JSON.stringify({ asOf: new Date().toISOString(), branches: perBranch }) };
  } catch (err) {
    if (!err.statusCode) console.error('territory-stats error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
