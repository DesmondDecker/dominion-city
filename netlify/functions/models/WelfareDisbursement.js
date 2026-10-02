const mongoose = require('mongoose');

// Append-only, same reasoning as GivingEntry and CheckIn: a caseworker
// doing a home visit with no signal must be able to log "gave 200,000 SLL
// to the Toray family" immediately, with zero risk of a sync conflict.
// Corrections are posted as a new entry with reversalOf set, never an edit.
const WelfareDisbursementSchema = new mongoose.Schema(
  {
    case: { type: mongoose.Schema.Types.ObjectId, ref: 'WelfareCase', required: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'WelfareRequest', default: null },

    type: { type: String, enum: ['financial', 'items'], required: true },
    amount: Number,
    currency: String,
    itemsGiven: [String],

    fundCode: { type: String, default: 'WELFARE' }, // reconciles against Church.funds / GivingEntry
    disbursedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    disbursedAt: { type: Date, required: true },

    clientEventId: { type: String, required: true, unique: true },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'WelfareDisbursement', default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.WelfareDisbursement ||
  mongoose.model('WelfareDisbursement', WelfareDisbursementSchema);
