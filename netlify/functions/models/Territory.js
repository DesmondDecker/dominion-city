const mongoose = require('mongoose');

const TerritorySchema = new mongoose.Schema(
  {
    church: { type: mongoose.Schema.Types.ObjectId, ref: 'Church', required: true },
    name: { type: String, required: true }, // "West Africa", "Sierra Leone", "UK & Ireland"
    type: { type: String, enum: ['continent', 'country', 'region'], required: true },
    parentTerritory: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', default: null },
    territoryAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

TerritorySchema.index({ church: 1, parentTerritory: 1 });

module.exports =
  mongoose.models.Territory || mongoose.model('Territory', TerritorySchema);
