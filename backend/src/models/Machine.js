// ============================================
// LUNEX — Machine Model
// ============================================
const mongoose = require('mongoose');
const { MACHINE_STATUS } = require('../config/constants');

const machineSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: [true, 'Machine ID is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Machine name is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(MACHINE_STATUS),
      default: MACHINE_STATUS.AVAILABLE,
    },
    esp32Ip: {
      type: String,
      trim: true,
    },
    relayPin: {
      type: Number,
      default: 0,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastHeartbeat: {
      type: Date,
    },
    currentBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    currentSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    totalUsageCount: {
      type: Number,
      default: 0,
    },
    totalUsageMinutes: {
      type: Number,
      default: 0,
    },
    maintenanceNote: {
      type: String,
      trim: true,
    },
    lastMaintenanceDate: {
      type: Date,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Machine', machineSchema);
