// ============================================
// LUNEX — Priority Rebook Model
// ============================================
const mongoose = require('mongoose');
const { PRIORITY_REBOOK_STATUS } = require('../config/constants');

const priorityRebookSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originalBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
    },
    offeredSlot: {
      machine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
      },
      startTime: Date,
      endTime: Date,
    },
    status: {
      type: String,
      enum: Object.values(PRIORITY_REBOOK_STATUS),
      default: PRIORITY_REBOOK_STATUS.OFFERED,
    },
    newBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PriorityRebook', priorityRebookSchema);
