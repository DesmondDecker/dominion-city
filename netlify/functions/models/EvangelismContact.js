const mongoose = require('mongoose');

// Append-only, same offline-safety reasoning as CheckIn — a volunteer
// out doing door-to-door outreach or working a crusade needs to log a
// contact instantly with zero risk of losing it or double-syncing it.
const EvangelismContactSchema = new mongoose.Schema(
  {
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    contactedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contactedAt: { type: Date, required: true },

    name: String,
    phone: String,
    location: String, // area/zone reached, useful for mobilisation planning

    outcome: {
      type: String,
      enum: ['accepted_christ', 'interested', 'not_interested', 'already_member', 'other'],
      default: 'interested',
    },
    followUpNeeded: { type: Boolean, default: true },
    followUpDate: Date,
    notes: String,

    // Set once this contact is entered as a real Member/Visitor record.
    convertedMember: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },

    clientEventId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.EvangelismContact ||
  mongoose.model('EvangelismContact', EvangelismContactSchema);
