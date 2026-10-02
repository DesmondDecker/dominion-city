const mongoose = require('mongoose');

// Same reasoning as CheckIn: append-only so two devices marking the
// same person present at a rehearsal never conflict, and a retried
// offline sync never double-counts. "Was X present" is computed from
// the latest matching entry, not stored as mutable state.
const DepartmentAttendanceSchema = new mongoose.Schema(
  {
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    meetingDate: { type: Date, required: true },

    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clientEventId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.DepartmentAttendance ||
  mongoose.model('DepartmentAttendance', DepartmentAttendanceSchema);
