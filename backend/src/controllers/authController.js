// ============================================
// LUNEX — Auth Controller
// ============================================
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const { ACCOUNT_STATUS, ROLES, NOTIFICATION_TYPES } = require('../config/constants');
const { createNotification } = require('../services/notificationService');

/**
 * Generate JWT tokens
 */
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

  return { accessToken, refreshToken };
};

/**
 * @desc    Register a new user (hosteller)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, roomNumber, hostelBlock } = req.body;

  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered.', 409);
  }

  // Create user with pending status
  const user = await User.create({
    name,
    email,
    phone,
    password,
    roomNumber,
    hostelBlock,
    role: ROLES.USER,
    accountStatus: ACCOUNT_STATUS.PENDING,
  });

  // Generate tokens (user can check status but can't access protected routes)
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Store refresh token
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 201, true, 'Registration successful. Awaiting admin approval.', {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    },
    accessToken,
    refreshToken,
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  // Check account status
  if (user.accountStatus === ACCOUNT_STATUS.BLOCKED) {
    throw new AppError('Your account has been blocked. Contact admin.', 403);
  }

  if (user.accountStatus === ACCOUNT_STATUS.REJECTED) {
    throw new AppError('Your registration was rejected. Contact admin.', 403);
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Update refresh token and last login
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 200, true, 'Login successful.', {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      rfidUID: user.rfidUID,
      roomNumber: user.roomNumber,
      hostelBlock: user.hostelBlock,
    },
    accessToken,
    refreshToken,
  });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token is required.', 400);
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      throw new AppError('Invalid refresh token.', 401);
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    sendResponse(res, 200, true, 'Token refreshed.', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AppError('Invalid or expired refresh token. Please login again.', 401);
    }
    throw error;
  }
});

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  sendResponse(res, 200, true, 'Profile retrieved.', { user });
});

/**
 * @desc    Check account status (allow pending users)
 * @route   GET /api/auth/status
 * @access  Private (allows pending)
 */
const checkStatus = asyncHandler(async (req, res) => {
  sendResponse(res, 200, true, 'Account status retrieved.', {
    accountStatus: req.user.accountStatus,
    role: req.user.role,
    rfidAssigned: !!req.user.rfidUID,
  });
});

/**
 * @desc    Update profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'phone', 'roomNumber', 'hostelBlock', 'fcmToken'];
  const updates = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    returnDocument: 'after',
    runValidators: true,
  });

  sendResponse(res, 200, true, 'Profile updated.', { user });
});

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect.', 400);
  }

  user.password = newPassword;
  await user.save();

  // Generate new tokens
  const { accessToken, refreshToken } = generateTokens(user._id);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 200, true, 'Password changed successfully.', {
    accessToken,
    refreshToken,
  });
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });

  sendResponse(res, 200, true, 'Logged out successfully.');
});

module.exports = {
  register,
  login,
  refreshAccessToken,
  getMe,
  checkStatus,
  updateProfile,
  changePassword,
  logout,
};
