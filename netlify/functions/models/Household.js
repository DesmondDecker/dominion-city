const mongoose = require('mongoose');

const HouseholdSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true }, // "The Holt Household"
    address: String,
    phone: String,
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Household || mongoose.model('Household', HouseholdSchema);
