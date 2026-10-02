const mongoose = require('mongoose');

const WelfareCaseSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },

    category: {
      type: String,
      enum: ['financial_hardship', 'medical', 'bereavement', 'food', 'housing', 'other'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'approved', 'declined', 'closed'],
      default: 'open',
    },

    summary: { type: String, required: true }, // short, non-sensitive description for list views
    details: String, // sensitive — only returned to authorized viewers, see welfare-cases.js

    assignedCaseworker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Explicit extra viewers beyond the default (national admin, branch admin,
    // welfare department head, assigned caseworker) — e.g. a second caseworker
    // temporarily covering.
    additionalViewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    closedAt: Date,
    closureReason: String,
  },
  { timestamps: true }
);

WelfareCaseSchema.index({ branch: 1, status: 1 });
WelfareCaseSchema.index({ assignedCaseworker: 1 });

module.exports =
  mongoose.models.WelfareCase || mongoose.model('WelfareCase', WelfareCaseSchema);
