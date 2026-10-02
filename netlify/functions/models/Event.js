const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    church: { type: mongoose.Schema.Types.ObjectId, ref: 'Church', required: true },
    // Empty branches array = applies to all branches
    branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },

    title: { type: String, required: true },
    description: String,
    category: String, // matches Church.eventCategories
    location: String,
    coverImageUrl: String,

    startsAt: { type: Date, required: true },
    endsAt: Date,

    recurrence: {
      pattern: { type: String, enum: [null, 'weekly', 'monthly'], default: null },
      until: Date,
    },

    capacity: Number, // null = unlimited
    rsvpDeadline: Date,
    rsvpVisibility: { type: String, enum: ['public', 'members_only'], default: 'public' },

    status: { type: String, enum: ['draft', 'published', 'cancelled'], default: 'draft' },
    archivedAt: Date,
  },
  { timestamps: true }
);

EventSchema.index({ branches: 1, startsAt: 1 });
EventSchema.index({ startsAt: 1 });

module.exports = mongoose.models.Event || mongoose.model('Event', EventSchema);
