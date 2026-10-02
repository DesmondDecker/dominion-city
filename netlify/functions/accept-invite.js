const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB } = require('./lib/db');
const StaffInvite = require('./models/StaffInvite');
const User = require('./models/User');

exports.handler = async (event) => {
  try {
    await connectDB();
    const params = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      // Used by the accept-invite page to show who's being invited
      // before asking for a password.
      if (!params.token) return { statusCode: 400, body: JSON.stringify({ error: 'token is required' }) };
      const invite = await StaffInvite.findOne({ token: params.token });
      if (!invite) return { statusCode: 404, body: JSON.stringify({ error: 'Invite not found' }) };
      if (invite.acceptedAt) return { statusCode: 410, body: JSON.stringify({ error: 'This invite has already been used' }) };
      if (invite.expiresAt < new Date()) return { statusCode: 410, body: JSON.stringify({ error: 'This invite has expired' }) };

      return { statusCode: 200, body: JSON.stringify({ name: invite.name, email: invite.email, role: invite.role }) };
    }

    if (event.httpMethod === 'POST') {
      const { token, password } = JSON.parse(event.body || '{}');
      if (!token || !password || password.length < 8) {
        return { statusCode: 400, body: JSON.stringify({ error: 'token and a password (8+ characters) are required' }) };
      }

      const invite = await StaffInvite.findOne({ token });
      if (!invite) return { statusCode: 404, body: JSON.stringify({ error: 'Invite not found' }) };
      if (invite.acceptedAt) return { statusCode: 410, body: JSON.stringify({ error: 'This invite has already been used' }) };
      if (invite.expiresAt < new Date()) return { statusCode: 410, body: JSON.stringify({ error: 'This invite has expired' }) };

      const existing = await User.findOne({ email: invite.email });
      if (existing) {
        return { statusCode: 409, body: JSON.stringify({ error: 'An account with this email already exists' }) };
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        name: invite.name,
        email: invite.email,
        passwordHash,
        role: invite.role,
        branches: invite.branches,
        departments: invite.departments,
        territories: invite.territories,
      });

      invite.acceptedAt = new Date();
      invite.acceptedUser = user._id;
      await invite.save();

      // Log them straight in, same token shape as auth-login.js.
      const authToken = jwt.sign(
        { userId: user._id, role: user.role, branches: user.branches, departments: user.departments, territories: user.territories },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return {
        statusCode: 201,
        body: JSON.stringify({ token: authToken, user: { id: user._id, name: user.name, role: user.role } }),
      };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('accept-invite error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
