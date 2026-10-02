const mongoose = require('mongoose');

// Append-only ledger. Never edit or delete an entry — corrections are
// posted as a new entry with a negative amount and a reversalOf reference.
// Same offline-safety reasoning as CheckIn.
const GivingEntrySchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null }, // null = anonymous
    fundCode: { type: String, required: true }, // matches Church.funds[].code

    amount: { type: Number, required: true },
    currency: { type: String, required: true },

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceDate: { type: Date, required: true },

    clientEventId: { type: String, required: true, unique: true },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'GivingEntry', default: null },
  },
  { timestamps: true }
);

GivingEntrySchema.index({ branch: 1, serviceDate: 1 });
GivingEntrySchema.index({ member: 1 });

module.exports =
  mongoose.models.GivingEntry ||
  mongoose.model('GivingEntry', GivingEntrySchema);
