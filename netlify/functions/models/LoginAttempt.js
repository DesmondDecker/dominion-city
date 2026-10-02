const mongoose = require('mongoose');

const LoginAttemptSchema = new mongoose.Schema({
  email: { type: String, required: true },
  failedCount: { type: Number, default: 0 },
  lockedUntil: Date,
  lastAttemptAt: Date,
});

LoginAttemptSchema.index({ email: 1 }, { unique: true });

module.exports =
  mongoose.models.LoginAttempt || mongoose.model('LoginAttempt', LoginAttemptSchema);
