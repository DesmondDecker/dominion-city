const mongoose = require('mongoose');

const EventRSVPSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },

    // Public RSVPs (no login) capture a name/phone instead of a member id.
    guestName: String,
    guestPhone: String,

    status: { type: String, enum: ['going', 'cancelled'], default: 'going' },
  },
  { timestamps: true }
);

// One RSVP per member per event — re-RSVPing updates the existing record.
EventRSVPSchema.index(
  { event: 1, member: 1 },
  { unique: true, partialFilterExpression: { member: { $type: 'objectId' } } }
);

module.exports =
  mongoose.models.EventRSVP || mongoose.model('EventRSVP', EventRSVPSchema);
