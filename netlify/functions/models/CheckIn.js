const mongoose = require('mongoose');

// Append-only by convention: never update or delete a CheckIn document.
// "Is this member checked in" is derived by querying the latest entry
// for (member, event/service, date) — not stored as mutable state.
// This is what makes offline check-in safe: two devices can both write
// an entry for the same person without any conflict to resolve.
const CheckInSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null }, // null = regular Sunday service
    serviceDate: { type: Date, required: true },

    checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    device: String, // device identifier, for audit/debugging sync issues

    // Client-generated UUID so the same offline check-in never gets
    // double-inserted if the sync retries.
    clientEventId: { type: String, required: true, unique: true },

    visitingFromBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

    // Undo is a reversal record, never a delete or edit — same reasoning
    // as append-only everywhere else in this app. References the
    // original's clientEventId (a string), not a Mongo _id, because the
    // original may not have synced yet when someone undoes it offline.
    reversalOf: { type: String, default: null },
  },
  { timestamps: true }
);

CheckInSchema.index({ branch: 1, serviceDate: 1 });

module.exports =
  mongoose.models.CheckIn || mongoose.model('CheckIn', CheckInSchema);
