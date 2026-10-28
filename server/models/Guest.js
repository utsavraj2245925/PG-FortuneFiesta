const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema(
  {
    serialNo: { type: Number, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: '' },
    guestNumber: { type: String, trim: true, default: '' },
    won: { type: Boolean, default: false },
    wonRound: { type: Number, default: null },
    prize: { type: mongoose.Schema.Types.ObjectId, ref: 'Prize', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Guest', guestSchema);
