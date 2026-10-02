const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', default: null },

    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: String,
    email: String,

    status: {
      type: String,
      enum: ['visitor', 'member', 'at-risk'],
      default: 'visitor',
    },

    joinedAt: Date,
    lastAttendedAt: Date,

    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],

    // Guardian/pickup auth for children's ministry
    isChild: { type: Boolean, default: false },
    authorizedGuardians: [String],
    medicalNotes: String, // access-restrict this field at the API layer

    // Soft delete / GDPR-style removal request support
    deletionRequestedAt: Date,

    // Every branch change gets logged here — needed for a global
    // church where a member moving branches might mean moving countries.
    transferHistory: [
      {
        fromBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
        toBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
        transferredAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

MemberSchema.index({ branch: 1, status: 1 });
MemberSchema.index({ branch: 1, departments: 1 });
MemberSchema.index({ firstName: 1, lastName: 1 });

module.exports =
  mongoose.models.Member || mongoose.model('Member', MemberSchema);
