const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
  roundNo: { type: Number, required: true, unique: true, min: 1, max: 10 },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  imageUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Prize', prizeSchema);
