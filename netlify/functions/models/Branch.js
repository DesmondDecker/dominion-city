const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema(
  {
    church: { type: mongoose.Schema.Types.ObjectId, ref: 'Church', required: true },
    name: { type: String, required: true }, // "Wilkinson Road", "Freetown"
    type: { type: String, enum: ['branch', 'fellowship'], required: true },
    // If type is "fellowship", parentBranch may point to a branch it reports to.
    // If null, it reports directly to national.
    parentBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

    // Which Territory (Country/Region) this branch sits under — optional,
    // for rollup reporting ("how is West Africa doing").
    territory: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', default: null },

    address: String,
    serviceTimes: [String], // ["Sun 9:00am", "Sun 11:30am"]
    timeZone: String, // overrides church default if set

    status: {
      type: String,
      enum: ['active', 'pending', 'inactive'],
      default: 'pending',
    },

    logoUrl: String, // optional local override of the church logo
    brandColors: {
      primary: String,
      accent: String,
    },

    atRiskWeeksThreshold: Number, // overrides church default if set

    adminUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Branch || mongoose.model('Branch', BranchSchema);
