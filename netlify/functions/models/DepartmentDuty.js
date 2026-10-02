const mongoose = require('mongoose');

const DepartmentDutySchema = new mongoose.Schema(
  {
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    dutyDate: { type: Date, required: true },
    role: String, // "Lead", "Usher", "Sound", etc. — free text, department-specific
    notes: String,
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.DepartmentDuty || mongoose.model('DepartmentDuty', DepartmentDutySchema);
