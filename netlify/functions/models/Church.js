const mongoose = require('mongoose');

const ChurchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "Dominion City Church"
    logoUrl: String,
    faviconUrl: String,
    brandColors: {
      primary: { type: String, default: '#1e2a4a' },
      accent: { type: String, default: '#c9822a' },
    },
    defaultSettings: {
      atRiskWeeksThreshold: { type: Number, default: 4 },
      timeZone: { type: String, default: 'Africa/Freetown' },
      currency: { type: String, default: 'SLL' },
    },
    funds: [
      {
        name: String, // "Tithe", "Building Fund", "Missions"
        code: String,
      },
    ],
    eventCategories: [String], // "Youth", "Outreach", "Bible Study"
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Church || mongoose.model('Church', ChurchSchema);
