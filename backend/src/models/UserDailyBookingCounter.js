// ============================================
// LUNEX — User Daily Booking Counter Model
// ============================================
const mongoose = require('mongoose');

const userDailyBookingCounterSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    slotDate: {
      type: Date,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

userDailyBookingCounterSchema.index({ user: 1, slotDate: 1 }, { unique: true });

module.exports = mongoose.model('UserDailyBookingCounter', userDailyBookingCounterSchema);
