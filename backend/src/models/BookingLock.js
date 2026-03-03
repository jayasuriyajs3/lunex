// ============================================
// LUNEX — Booking Lock Model
// ============================================
const mongoose = require('mongoose');

const bookingLockSchema = new mongoose.Schema(
  {
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      required: true,
      index: true,
    },
    lockTime: {
      type: Date,
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

bookingLockSchema.index({ machine: 1, lockTime: 1 }, { unique: true });

module.exports = mongoose.model('BookingLock', bookingLockSchema);
