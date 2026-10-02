const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: [
        'national_admin',
        'territory_admin',
        'branch_admin',
        'fellowship_leader',
        'department_head',
        'campus_staff',
        'checkin_volunteer',
      ],
      required: true,
    },

    // Scope: which branches/departments/territories this user can
    // access. national_admin ignores these (full access).
    branches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    territories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Territory' }],

    lastLoginAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
