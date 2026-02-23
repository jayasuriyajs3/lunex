// ============================================
// LUNEX — Session Model
// ============================================
const mongoose = require('mongoose');
const { SESSION_STATUS } = require('../config/constants');

const sessionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.RUNNING,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    scheduledEndAt: {
      type: Date,
      required: true,
    },
    actualEndAt: {
      type: Date,
      default: null,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    resumedAt: {
      type: Date,
      default: null,
    },
    totalPausedMinutes: {
      type: Number,
      default: 0,
    },
    extensionGranted: {
      type: Boolean,
      default: false,
    },
    extensionMinutes: {
      type: Number,
      default: 0,
    },
    extendedEndAt: {
      type: Date,
      default: null,
    },
    powerOnAt: {
      type: Date,
      default: null,
    },
    powerOffAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
    interruptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      default: null,
    },
    terminatedBy: {
      type: String,
      enum: ['system', 'user', 'warden', 'admin', 'auto', null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ status: 1 });
sessionSchema.index({ user: 1 });
sessionSchema.index({ machine: 1 });

module.exports = mongoose.model('Session', sessionSchema);
