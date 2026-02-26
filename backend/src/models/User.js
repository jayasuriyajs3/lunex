// ============================================
// LUNEX — User Model
// ============================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    accountStatus: {
      type: String,
      enum: Object.values(ACCOUNT_STATUS),
      default: ACCOUNT_STATUS.PENDING,
    },
    rfidUID: {
      type: String,
      trim: true,
      set: (value) => {
        if (typeof value !== 'string') return undefined;
        const normalized = value.trim();
        return normalized.length ? normalized : undefined;
      },
    },
    roomNumber: {
      type: String,
      trim: true,
    },
    hostelBlock: {
      type: String,
      trim: true,
    },
    noShowCount: {
      type: Number,
      default: 0,
    },
    totalBookings: {
      type: Number,
      default: 0,
    },
    totalSessions: {
      type: Number,
      default: 0,
    },
    hasPriorityRebook: {
      type: Boolean,
      default: false,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index(
  { rfidUID: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rfidUID: { $type: 'string' },
    },
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
