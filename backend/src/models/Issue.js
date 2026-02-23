// ============================================
// LUNEX — Issue Model
// ============================================
const mongoose = require('mongoose');
const { ISSUE_TYPES, ISSUE_STATUS } = require('../config/constants');

const issueSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    machine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Machine',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    issueType: {
      type: String,
      enum: Object.values(ISSUE_TYPES),
      required: [true, 'Issue type is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: Object.values(ISSUE_STATUS),
      default: ISSUE_STATUS.REPORTED,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
    },
    sessionPaused: {
      type: Boolean,
      default: false,
    },
    priorityRebookOffered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

issueSchema.index({ status: 1 });
issueSchema.index({ machine: 1 });

module.exports = mongoose.model('Issue', issueSchema);
