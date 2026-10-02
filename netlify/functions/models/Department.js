const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    church: { type: mongoose.Schema.Types.ObjectId, ref: 'Church', required: true },
    name: { type: String, required: true }, // "Choir", "Ushering", "Media"
    description: String,

    scope: {
      type: String,
      enum: ['national', 'branch'],
      default: 'branch',
    },
    // Only set when scope is "branch"
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },

    parentDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    }, // for sub-departments e.g. Media -> Sound

    headUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    defaultMeeting: {
      dayOfWeek: String,
      time: String,
    },

    joinPolicy: {
      type: String,
      enum: ['open', 'approval'],
      default: 'open',
    },

    // Opt-in feature flag, not hardcoded to a department name — lets a
    // department like "Evangelism & Mobilisation" track field contacts
    // (who was reached, outcome, follow-up) without every department
    // carrying that workflow.
    trackOutreachContacts: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Department || mongoose.model('Department', DepartmentSchema);
