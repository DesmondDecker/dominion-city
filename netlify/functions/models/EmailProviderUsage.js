const mongoose = require('mongoose');

// One document per provider per day. Serverless functions have no
// persistent memory between invocations, so quota tracking has to live
// in the database, not a module-level variable.
const EmailProviderUsageSchema = new mongoose.Schema({
  provider: { type: String, required: true },
  dateKey: { type: String, required: true }, // "2026-09-16", UTC day bucket
  count: { type: Number, default: 0 },
});

EmailProviderUsageSchema.index({ provider: 1, dateKey: 1 }, { unique: true });

module.exports =
  mongoose.models.EmailProviderUsage ||
  mongoose.model('EmailProviderUsage', EmailProviderUsageSchema);
