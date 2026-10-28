const mongoose = require('mongoose');

const gameStateSchema = new mongoose.Schema({
  singleton: { type: String, default: 'state', unique: true },
  currentRound: { type: Number, default: 1, min: 1, max: 9 },
  // status: idle | spinning | revealed | completed
  status: { type: String, default: 'idle', enum: ['idle', 'spinning', 'revealed', 'completed'] },
  isActive: { type: Boolean, default: false },
  totalEmployees: { type: Number, default: 0 },
  groupSize: { type: Number, default: 0 }, // employees per group
  // group boundaries (inclusive)
  groups: {
    1: { start: { type: Number }, end: { type: Number } },
    2: { start: { type: Number }, end: { type: Number } },
    3: { start: { type: Number }, end: { type: Number } },
  },
  // Guest Round State
  guestStatus: { type: String, default: 'idle', enum: ['idle', 'spinning', 'revealed'] },
  guestWinner: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', default: null },
  guestPrize: { type: mongoose.Schema.Types.ObjectId, ref: 'Prize', default: null },
  // Fiesta Winners Grand Display
  showFiestaWinners: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('GameState', gameStateSchema);
