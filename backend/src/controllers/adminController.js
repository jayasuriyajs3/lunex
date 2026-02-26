// ============================================
// LUNEX — Admin Controller
// ============================================
const User = require('../models/User');
const Machine = require('../models/Machine');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const Issue = require('../models/Issue');
const SystemConfig = require('../models/SystemConfig');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const {
  ACCOUNT_STATUS,
  ROLES,
  BOOKING_STATUS,
  MACHINE_STATUS,
  SESSION_STATUS,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const { createNotification } = require('../services/notificationService');
const { startOfDay, endOfDay } = require('../utils/dateHelpers');

// ========== USER MANAGEMENT ==========

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { status, role, page = 1, limit = 50, search } = req.query;

  const query = {};
  if (status) query.accountStatus = status;
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  sendResponse(res, 200, true, 'Users retrieved.', {
    users,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * @desc    Get pending registrations
 * @route   GET /api/admin/users/pending
 * @access  Private (Admin)
 */
const getPendingUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ accountStatus: ACCOUNT_STATUS.PENDING }).sort({
    createdAt: -1,
  });

  sendResponse(res, 200, true, 'Pending users retrieved.', { users, count: users.length });
});

/**
 * @desc    Approve a user registration
 * @route   PUT /api/admin/users/approve
 * @access  Private (Admin)
 */
const approveUser = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.accountStatus !== ACCOUNT_STATUS.PENDING) {
    throw new AppError(`User account is already ${user.accountStatus}.`, 400);
  }

  user.accountStatus = ACCOUNT_STATUS.ACTIVE;
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  await user.save();

  await createNotification(
    user._id,
    NOTIFICATION_TYPES.ACCOUNT_APPROVED,
    'Account Approved',
    'Your account has been approved! You can now book washing machine slots.',
    {}
  );

  sendResponse(res, 200, true, 'User approved successfully.', { user });
});

/**
 * @desc    Reject a user registration
 * @route   PUT /api/admin/users/reject
 * @access  Private (Admin)
 */
const rejectUser = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  user.accountStatus = ACCOUNT_STATUS.REJECTED;
  await user.save();

  sendResponse(res, 200, true, 'User registration rejected.', { user });
});

/**
 * @desc    Block a user
 * @route   PUT /api/admin/users/block
 * @access  Private (Admin)
 */
const blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.role === ROLES.ADMIN) {
    throw new AppError('Cannot block an admin.', 400);
  }

  user.accountStatus = ACCOUNT_STATUS.BLOCKED;
  await user.save();

  // Cancel all upcoming bookings
  await Booking.updateMany(
    {
      user: user._id,
      status: BOOKING_STATUS.CONFIRMED,
      startTime: { $gte: new Date() },
    },
    {
      status: BOOKING_STATUS.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: 'User account blocked',
    }
  );

  await createNotification(
    user._id,
    NOTIFICATION_TYPES.ACCOUNT_BLOCKED,
    'Account Blocked',
    'Your account has been blocked. Contact admin for assistance.',
    {}
  );

  sendResponse(res, 200, true, 'User blocked.', { user });
});

/**
 * @desc    Unblock a user
 * @route   PUT /api/admin/users/unblock
 * @access  Private (Admin)
 */
const unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.accountStatus !== ACCOUNT_STATUS.BLOCKED) {
    throw new AppError('User is not blocked.', 400);
  }

  user.accountStatus = ACCOUNT_STATUS.ACTIVE;
  await user.save();

  sendResponse(res, 200, true, 'User unblocked.', { user });
});

/**
 * @desc    Assign RFID to user
 * @route   PUT /api/admin/users/assign-rfid
 * @access  Private (Admin)
 */
const assignRFID = asyncHandler(async (req, res) => {
  const { userId, rfidUID } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  // Check if RFID already assigned to someone else
  const existingUser = await User.findOne({ rfidUID, _id: { $ne: userId } });
  if (existingUser) {
    throw new AppError('This RFID is already assigned to another user.', 409);
  }

  user.rfidUID = rfidUID;
  await user.save();

  await createNotification(
    user._id,
    NOTIFICATION_TYPES.RFID_ASSIGNED,
    'RFID Card Assigned',
    `An RFID card has been assigned to your account. You can now scan to access machines.`,
    { rfidUID }
  );

  sendResponse(res, 200, true, 'RFID assigned successfully.', { user });
});

/**
 * @desc    Revoke RFID from user
 * @route   PUT /api/admin/users/revoke-rfid
 * @access  Private (Admin)
 */
const revokeRFID = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  user.rfidUID = null;
  await user.save();

  sendResponse(res, 200, true, 'RFID revoked.', { user });
});

/**
 * @desc    Change user role
 * @route   PUT /api/admin/users/change-role
 * @access  Private (Admin)
 */
const changeUserRole = asyncHandler(async (req, res) => {
  const { userId, role } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (!Object.values(ROLES).includes(role)) {
    throw new AppError('Invalid role.', 400);
  }

  // Don't allow changing own role
  if (userId === req.user._id.toString()) {
    throw new AppError('Cannot change your own role.', 400);
  }

  user.role = role;

  if (user.accountStatus === ACCOUNT_STATUS.PENDING && (role === ROLES.ADMIN || role === ROLES.WARDEN)) {
    user.accountStatus = ACCOUNT_STATUS.ACTIVE;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
  }

  await user.save();

  sendResponse(res, 200, true, `User role changed to ${role}.`, { user });
});

/**
 * @desc    Reset user password (Admin)
 * @route   PUT /api/admin/users/reset-password
 * @access  Private (Admin)
 */
const resetUserPassword = asyncHandler(async (req, res) => {
  const { userId, newPassword } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  user.password = newPassword;
  await user.save();

  sendResponse(res, 200, true, 'Password reset successfully.');
});

// ========== SYSTEM CONFIGURATION ==========

/**
 * @desc    Get all system configs
 * @route   GET /api/admin/config
 * @access  Private (Admin)
 */
const getSystemConfigs = asyncHandler(async (req, res) => {
  const configs = await SystemConfig.find().populate('updatedBy', 'name email');

  sendResponse(res, 200, true, 'System configs retrieved.', { configs });
});

/**
 * @desc    Set/update a system config
 * @route   PUT /api/admin/config
 * @access  Private (Admin)
 */
const setSystemConfig = asyncHandler(async (req, res) => {
  const { key, value, description } = req.body;

  const config = await SystemConfig.findOneAndUpdate(
    { key },
    {
      value,
      description,
      updatedBy: req.user._id,
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );

  sendResponse(res, 200, true, 'Config updated.', { config });
});

/**
 * @desc    Delete a system config
 * @route   DELETE /api/admin/config/:key
 * @access  Private (Admin)
 */
const deleteSystemConfig = asyncHandler(async (req, res) => {
  const config = await SystemConfig.findOneAndDelete({ key: req.params.key });

  if (!config) {
    throw new AppError('Config not found.', 404);
  }

  sendResponse(res, 200, true, 'Config deleted.');
});

// ========== EMERGENCY CONTROLS ==========

/**
 * @desc    Emergency shutdown all machines
 * @route   POST /api/admin/emergency/shutdown
 * @access  Private (Admin)
 */
const emergencyShutdown = asyncHandler(async (req, res) => {
  // End all active sessions
  const activeSessions = await Session.find({
    status: { $in: [SESSION_STATUS.RUNNING, SESSION_STATUS.PAUSED] },
  });

  for (const session of activeSessions) {
    session.status = SESSION_STATUS.TERMINATED;
    session.actualEndAt = new Date();
    session.powerOffAt = new Date();
    session.terminatedBy = 'admin';
    await session.save();

    await Booking.findByIdAndUpdate(session.booking, {
      status: BOOKING_STATUS.INTERRUPTED,
    });

    await createNotification(
      session.user,
      NOTIFICATION_TYPES.EMERGENCY,
      'Emergency Shutdown',
      'All machines have been shut down. Your session has been interrupted.',
      { sessionId: session._id }
    );
  }

  // Cancel all upcoming bookings
  await Booking.updateMany(
    {
      status: BOOKING_STATUS.CONFIRMED,
      startTime: { $gte: new Date() },
    },
    {
      status: BOOKING_STATUS.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: 'Emergency shutdown',
    }
  );

  // Set all machines to disabled
  await Machine.updateMany(
    {},
    {
      status: MACHINE_STATUS.DISABLED,
      currentBooking: null,
      currentSession: null,
    }
  );

  sendResponse(res, 200, true, 'Emergency shutdown executed.', {
    sessionsTerminated: activeSessions.length,
  });
});

/**
 * @desc    Emergency reset — re-enable all machines
 * @route   POST /api/admin/emergency/reset
 * @access  Private (Admin)
 */
const emergencyReset = asyncHandler(async (req, res) => {
  await Machine.updateMany(
    { status: MACHINE_STATUS.DISABLED },
    {
      status: MACHINE_STATUS.AVAILABLE,
      currentBooking: null,
      currentSession: null,
    }
  );

  const machines = await Machine.find();

  sendResponse(res, 200, true, 'Emergency reset complete. All machines re-enabled.', {
    machinesReset: machines.length,
  });
});

// ========== ANALYTICS & REPORTING ==========

/**
 * @desc    Get dashboard analytics
 * @route   GET /api/admin/analytics/dashboard
 * @access  Private (Admin)
 */
const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const [
    totalUsers,
    activeUsers,
    pendingUsers,
    totalMachines,
    availableMachines,
    inUseMachines,
    maintenanceMachines,
    todayBookings,
    todayCompleted,
    todayNoShows,
    todayCancelled,
    totalBookingsAllTime,
    totalSessionsAllTime,
    openIssues,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.USER }),
    User.countDocuments({ role: ROLES.USER, accountStatus: ACCOUNT_STATUS.ACTIVE }),
    User.countDocuments({ accountStatus: ACCOUNT_STATUS.PENDING }),
    Machine.countDocuments(),
    Machine.countDocuments({ status: MACHINE_STATUS.AVAILABLE }),
    Machine.countDocuments({ status: MACHINE_STATUS.IN_USE }),
    Machine.countDocuments({
      status: { $in: [MACHINE_STATUS.MAINTENANCE, MACHINE_STATUS.REPAIR] },
    }),
    Booking.countDocuments({ slotDate: { $gte: todayStart, $lte: todayEnd } }),
    Booking.countDocuments({
      slotDate: { $gte: todayStart, $lte: todayEnd },
      status: BOOKING_STATUS.COMPLETED,
    }),
    Booking.countDocuments({
      slotDate: { $gte: todayStart, $lte: todayEnd },
      status: BOOKING_STATUS.NO_SHOW,
    }),
    Booking.countDocuments({
      slotDate: { $gte: todayStart, $lte: todayEnd },
      status: BOOKING_STATUS.CANCELLED,
    }),
    Booking.countDocuments(),
    Session.countDocuments(),
    Issue.countDocuments({ status: { $in: ['reported', 'verified'] } }),
  ]);

  sendResponse(res, 200, true, 'Dashboard analytics.', {
    users: {
      total: totalUsers,
      active: activeUsers,
      pending: pendingUsers,
    },
    machines: {
      total: totalMachines,
      available: availableMachines,
      inUse: inUseMachines,
      maintenance: maintenanceMachines,
    },
    today: {
      bookings: todayBookings,
      completed: todayCompleted,
      noShows: todayNoShows,
      cancelled: todayCancelled,
    },
    allTime: {
      totalBookings: totalBookingsAllTime,
      totalSessions: totalSessionsAllTime,
      openIssues,
    },
  });
});

/**
 * @desc    Get machine utilization report
 * @route   GET /api/admin/analytics/machine-utilization
 * @access  Private (Admin)
 */
const getMachineUtilization = asyncHandler(async (req, res) => {
  const machines = await Machine.find().select(
    'machineId name location totalUsageCount totalUsageMinutes status'
  );

  const utilization = machines.map((m) => ({
    machineId: m.machineId,
    name: m.name,
    location: m.location,
    status: m.status,
    totalSessions: m.totalUsageCount,
    totalMinutesUsed: m.totalUsageMinutes,
    totalHoursUsed: Math.round((m.totalUsageMinutes / 60) * 100) / 100,
  }));

  sendResponse(res, 200, true, 'Machine utilization report.', { utilization });
});

/**
 * @desc    Get no-show statistics
 * @route   GET /api/admin/analytics/no-shows
 * @access  Private (Admin)
 */
const getNoShowStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  const noShowBookings = await Booking.find({
    status: BOOKING_STATUS.NO_SHOW,
    createdAt: { $gte: since },
  })
    .populate('user', 'name email roomNumber noShowCount')
    .populate('machine', 'machineId name')
    .sort({ createdAt: -1 });

  // Group by user
  const userStats = {};
  noShowBookings.forEach((b) => {
    const userId = b.user._id.toString();
    if (!userStats[userId]) {
      userStats[userId] = {
        user: b.user,
        count: 0,
      };
    }
    userStats[userId].count++;
  });

  const topNoShowUsers = Object.values(userStats).sort((a, b) => b.count - a.count);

  sendResponse(res, 200, true, 'No-show statistics.', {
    totalNoShows: noShowBookings.length,
    period: `Last ${days} days`,
    topNoShowUsers: topNoShowUsers.slice(0, 10),
    recentNoShows: noShowBookings.slice(0, 20),
  });
});

/**
 * @desc    Get peak usage analysis
 * @route   GET /api/admin/analytics/peak-usage
 * @access  Private (Admin)
 */
const getPeakUsage = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));

  const bookings = await Booking.find({
    createdAt: { $gte: since },
    status: { $in: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.ACTIVE] },
  }).select('startTime');

  // Analyze by hour
  const hourlyUsage = new Array(24).fill(0);
  const dailyUsage = new Array(7).fill(0); // 0=Sun, 6=Sat

  bookings.forEach((b) => {
    const hour = new Date(b.startTime).getHours();
    const day = new Date(b.startTime).getDay();
    hourlyUsage[hour]++;
    dailyUsage[day]++;
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  sendResponse(res, 200, true, 'Peak usage analysis.', {
    period: `Last ${days} days`,
    hourlyUsage: hourlyUsage.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      bookings: count,
    })),
    dailyUsage: dailyUsage.map((count, day) => ({
      day: dayNames[day],
      bookings: count,
    })),
    peakHour: `${hourlyUsage.indexOf(Math.max(...hourlyUsage)).toString().padStart(2, '0')}:00`,
    peakDay: dayNames[dailyUsage.indexOf(Math.max(...dailyUsage))],
  });
});

module.exports = {
  // User management
  getAllUsers,
  getPendingUsers,
  approveUser,
  rejectUser,
  blockUser,
  unblockUser,
  assignRFID,
  revokeRFID,
  changeUserRole,
  resetUserPassword,
  // System config
  getSystemConfigs,
  setSystemConfig,
  deleteSystemConfig,
  // Emergency
  emergencyShutdown,
  emergencyReset,
  // Analytics
  getDashboardAnalytics,
  getMachineUtilization,
  getNoShowStats,
  getPeakUsage,
};
