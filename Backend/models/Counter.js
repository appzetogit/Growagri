const mongoose = require('mongoose');

// Atomic sequences for human-friendly IDs (e.g. booking numbers BKGA001)
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

counterSchema.statics.next = async function (name) {
  const counter = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
