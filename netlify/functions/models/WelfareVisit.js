const mongoose = require('mongoose');

const WelfareVisitSchema = new mongoose.Schema(
  {
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'WelfareCase', required: true },

    visitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    visitDate: { type: Date, required: true },
    visitType: { type: String, enum: ['home', 'hospital', 'phone', 'other'], default: 'home' },

    notes: String, // sensitive — same access rules as WelfareCase.details
    followUpNeeded: { type: Boolean, default: false },
    followUpDate: Date,

    clientEventId: { type: String, required: true, unique: true }, // offline-safe append
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.WelfareVisit || mongoose.model('WelfareVisit', WelfareVisitSchema);
