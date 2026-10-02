const mongoose = require('mongoose');

const WelfareRequestSchema = new mongoose.Schema(
  {
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'WelfareCase', required: true },

    type: { type: String, enum: ['financial', 'items'], required: true },
    amountRequested: Number,
    currency: String,
    itemsRequested: [String], // e.g. ["Rice, 2 bags", "School fees receipt"]

    justification: String, // sensitive

    status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    decisionNote: String,
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.WelfareRequest ||
  mongoose.model('WelfareRequest', WelfareRequestSchema);
