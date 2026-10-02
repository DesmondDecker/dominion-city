const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB } = require('./lib/db');
const User = require('./models/User');
const LoginAttempt = require('./models/LoginAttempt');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    await connectDB();
    const { email, password } = JSON.parse(event.body || '{}');
    if (!email || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email and password required' }) };
    }

    // Brute-force protection: track failed attempts per email in the
    // database rather than in-memory, since a serverless function has
    // no memory between separate requests.
    let attempt = await LoginAttempt.findOne({ email });
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((attempt.lockedUntil - new Date()) / 60000);
      return {
        statusCode: 429,
        body: JSON.stringify({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` }),
      };
    }

    const user = await User.findOne({ email });
    const valid = user && (await bcrypt.compare(password, user.passwordHash));

    if (!valid) {
      const failedCount = (attempt?.failedCount || 0) + 1;
      const update = { failedCount, lastAttemptAt: new Date() };
      if (failedCount >= MAX_FAILED_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }
      await LoginAttempt.findOneAndUpdate({ email }, update, { upsert: true });
      // Same message whether the email doesn't exist or the password is
      // wrong — don't reveal which one it was.
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
    }

    // Successful login clears the failure count.
    if (attempt) {
      await LoginAttempt.findOneAndUpdate({ email }, { failedCount: 0, lockedUntil: null });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role, branches: user.branches, departments: user.departments, territories: user.territories },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ token, user: { id: user._id, name: user.name, role: user.role } }),
    };
  } catch (err) {
    // Don't leak internal error details (stack traces, connection
    // strings in error messages) to the client on an unexpected failure.
    console.error('auth-login error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Something went wrong. Please try again.' }) };
  }
};
