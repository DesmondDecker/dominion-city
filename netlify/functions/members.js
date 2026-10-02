const { connectDB } = require('./lib/db');
const { requireAuth, assertBranchAccess } = require('./lib/auth');
const Member = require('./models/Member');

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET' && params.id) {
      const member = await Member.findById(params.id);
      if (!member) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      assertBranchAccess(authUser, member.branch);
      return { statusCode: 200, body: JSON.stringify(member) };
    }

    if (event.httpMethod === 'GET') {
      const query =
        authUser.role === 'national_admin' ? {} : { branch: { $in: authUser.branches } };

      if (params.branchId) {
        assertBranchAccess(authUser, params.branchId);
        query.branch = params.branchId;
      }
      if (params.status) query.status = params.status;
      if (params.departmentId) query.departments = params.departmentId;
      if (params.q) {
        // Simple case-insensitive match on name/phone. At real scale this
        // wants a Mongo text index rather than regex — fine for now.
        const rx = new RegExp(params.q.trim(), 'i');
        query.$or = [{ firstName: rx }, { lastName: rx }, { phone: rx }];
      }

      const members = await Member.find(query).sort({ lastName: 1, firstName: 1 }).limit(200);
      return { statusCode: 200, body: JSON.stringify(members) };
    }

    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      if (!payload.branch || !payload.firstName || !payload.lastName) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'branch, firstName, and lastName are required' }),
        };
      }
      assertBranchAccess(authUser, payload.branch);
      const member = await Member.create(payload);
      return { statusCode: 201, body: JSON.stringify(member) };
    }

    if (event.httpMethod === 'PATCH' && params.id) {
      const existing = await Member.findById(params.id);
      if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      assertBranchAccess(authUser, existing.branch);

      const updates = JSON.parse(event.body || '{}');
      const allowed = [
        'firstName', 'lastName', 'phone', 'email', 'status', 'household',
        'joinedAt', 'lastAttendedAt', 'departments',
        'isChild', 'authorizedGuardians', 'medicalNotes',
      ];
      const safeUpdates = {};
      for (const key of allowed) if (key in updates) safeUpdates[key] = updates[key];

      const updateDoc = { $set: safeUpdates };

      // Branch transfer is handled separately from the plain-field
      // whitelist above, since it needs to also log a history entry —
      // a silent overwrite would lose which branch (and by extension,
      // in a global church, which country) a member came from.
      if (updates.branch && String(updates.branch) !== String(existing.branch)) {
        assertBranchAccess(authUser, updates.branch);
        updateDoc.$set.branch = updates.branch;
        updateDoc.$push = {
          transferHistory: { fromBranch: existing.branch, toBranch: updates.branch, transferredAt: new Date() },
        };
      }

      const member = await Member.findByIdAndUpdate(params.id, updateDoc, { new: true });
      return { statusCode: 200, body: JSON.stringify(member) };
    }

    if (event.httpMethod === 'DELETE' && params.id) {
      const existing = await Member.findById(params.id);
      if (!existing) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      assertBranchAccess(authUser, existing.branch);
      await Member.findByIdAndDelete(params.id);
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('members error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
