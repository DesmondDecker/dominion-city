const crypto = require('crypto');
const { connectDB } = require('./lib/db');
const { requireAuth, assertBranchAccess } = require('./lib/auth');
const { getChurchId } = require('./lib/church');
const { sendEmail } = require('./lib/email');
const StaffInvite = require('./models/StaffInvite');

const INVITE_EXPIRY_DAYS = 7;

exports.handler = async (event) => {
  try {
    await connectDB();
    const authUser = requireAuth(event);

    if (event.httpMethod === 'GET') {
      if (!['national_admin', 'territory_admin', 'branch_admin'].includes(authUser.role)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Only an admin can view pending invites' }) };
      }
      const query =
        authUser.role === 'national_admin'
          ? { acceptedAt: { $exists: false } }
          : { acceptedAt: { $exists: false }, branches: { $in: authUser.branches || [] } };
      const invites = await StaffInvite.find(query).sort({ createdAt: -1 });
      return { statusCode: 200, body: JSON.stringify(invites) };
    }

    if (event.httpMethod === 'POST') {
      if (!['national_admin', 'branch_admin'].includes(authUser.role)) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Only an admin can invite staff' }) };
      }
      const payload = JSON.parse(event.body || '{}');
      if (!payload.email || !payload.name || !payload.role) {
        return { statusCode: 400, body: JSON.stringify({ error: 'email, name, and role are required' }) };
      }
      if (!payload.church) {
        payload.church = await getChurchId();
      }
      if (payload.role === 'national_admin' && authUser.role !== 'national_admin') {
        return { statusCode: 403, body: JSON.stringify({ error: 'Only a national admin can invite another national admin' }) };
      }
      if (authUser.role === 'branch_admin') {
        for (const b of payload.branches || []) assertBranchAccess(authUser, b);
      }

      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const invite = await StaffInvite.create({
        ...payload,
        token,
        invitedBy: authUser.userId,
        expiresAt,
      });

      const siteUrl = process.env.SITE_URL || 'https://your-site.netlify.app';
      const acceptUrl = `${siteUrl}/accept-invite?token=${token}`;
      let emailStatus = 'not_sent';
      try {
        const result = await sendEmail({
          to: payload.email,
          subject: `You're invited to Dominion City Church staff`,
          html: `
            <p>Hi ${payload.name},</p>
            <p>You've been invited to join the Dominion City Church staff system as <strong>${payload.role.replace('_', ' ')}</strong>.</p>
            <p><a href="${acceptUrl}">Click here to set your password and get started</a></p>
            <p>This link expires in ${INVITE_EXPIRY_DAYS} days.</p>
          `,
        });
        emailStatus = `sent_via_${result.sentVia}`;
      } catch (emailErr) {
        // The invite still exists even if every provider failed — an
        // admin can copy the accept link manually rather than the
        // whole invite being lost.
        emailStatus = `send_failed: ${emailErr.message}`;
      }

      return {
        statusCode: 201,
        body: JSON.stringify({ invite, emailStatus, acceptUrl }),
      };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('staff-invites error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
