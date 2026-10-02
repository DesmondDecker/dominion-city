const mongoose = require('mongoose');

const StaffInviteSchema = new mongoose.Schema(
  {
    church: { type: mongoose.Schema.Types.ObjectId, ref: 'Church', required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: [
        'national_admin', 'territory_admin', 'branch_admin', 'fellowship_leader',
        'department_head', 'campus_staff', 'checkin_volunteer',
      ],
      required: true,
    },
    branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    territories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Territory' }],

    token: { type: String, required: true, unique: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },

    acceptedAt: Date,
    acceptedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.StaffInvite || mongoose.model('StaffInvite', StaffInviteSchema);
