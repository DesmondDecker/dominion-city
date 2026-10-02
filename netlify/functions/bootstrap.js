const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB } = require('./lib/db');
const User = require('./models/User');
const Church = require('./models/Church');

exports.handler = async (event) => {
  try {
    await connectDB();

    if (event.httpMethod === 'GET') {
      // Used by the setup page to decide whether to show the bootstrap
      // form or redirect straight to login.
      const userCount = await User.countDocuments();
      return { statusCode: 200, body: JSON.stringify({ needsBootstrap: userCount === 0 }) };
    }

    if (event.httpMethod === 'POST') {
      // The critical guard: this endpoint permanently locks itself once
      // a single user exists, anywhere. No token, no special header can
      // reopen it — the only way this ever runs again is an empty
      // database, which shouldn't happen after go-live.
      const userCount = await User.countDocuments();
      if (userCount > 0) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'Setup has already been completed. Ask an existing admin to invite you instead.' }),
        };
      }

      const { name, email, password, churchName } = JSON.parse(event.body || '{}');
      if (!name || !email || !password || password.length < 8) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Name, email, and a password (8+ characters) are required.' }),
        };
      }

      const church = await Church.findOne();
      if (!church) {
        await Church.create({ name: churchName || 'Dominion City Church' });
      } else if (churchName) {
        await Church.findByIdAndUpdate(church._id, { name: churchName });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ name, email, passwordHash, role: 'national_admin', branches: [], departments: [] });

      const token = jwt.sign(
        { userId: user._id, role: user.role, branches: [], departments: [], territories: [] },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return {
        statusCode: 201,
        body: JSON.stringify({ token, user: { id: user._id, name: user.name, role: user.role } }),
      };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    if (!err.statusCode) console.error('bootstrap error:', err);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.statusCode ? err.message : 'Something went wrong. Please try again.' }),
    };
  }
};
