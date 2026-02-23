// ============================================
// LUNEX — Session Controller
// ============================================
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const Machine = require('../models/Machine');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const {
  SESSION_STATUS,
  BOOKING_STATUS,
  MACHINE_STATUS,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const { addMinutes, diffInMinutes } = require('../utils/dateHelpers');
const { createNotification } = require('../services/notificationService');
const { isSlotAvailable } = require('../services/bookingService');

/**
 * @desc    Start a session (after RFID scan validates booking)
 * @route   POST /api/sessions/start
 * @access  Internal (called after RFID validation)
 */
const startSession = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId).populate('machine');
  if (!booking) {
    throw new AppError('Booking not found.', 404);
  }

  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw new AppError(`Cannot start session for booking with status: ${booking.status}.`, 400);
  }

  // Create session
  const now = new Date();
  const session = await Session.create({
    booking: booking._id,
    user: booking.user,
    machine: booking.machine._id,
    status: SESSION_STATUS.RUNNING,
    startedAt: now,
    scheduledEndAt: booking.endTime,
    powerOnAt: now,
  });

  // Update booking
  booking.status = BOOKING_STATUS.ACTIVE;
  booking.arrivedAt = now;
  booking.session = session._id;
  await booking.save();

  // Update machine
  await Machine.findByIdAndUpdate(booking.machine._id, {
    status: MACHINE_STATUS.IN_USE,
    currentBooking: booking._id,
    currentSession: session._id,
  });

  // Update user session count
  await User.findByIdAndUpdate(booking.user, { $inc: { totalSessions: 1 } });

  // Send notification
  await createNotification(
    booking.user,
    NOTIFICATION_TYPES.SESSION_STARTED,
    'Session Started',
    `Your washing session has started. It will end at ${booking.endTime.toLocaleTimeString()}.`,
    { sessionId: session._id, bookingId: booking._id }
  );

  const populatedSession = await Session.findById(session._id)
    .populate('machine', 'machineId name location')
    .populate('user', 'name email')
    .populate('booking');

  sendResponse(res, 201, true, 'Session started successfully.', { session: populatedSession });
});

/**
 * @desc    Get active session for current user
 * @route   GET /api/sessions/active
 * @access  Private (User)
 */
const getActiveSession = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    user: req.user._id,
    status: { $in: [SESSION_STATUS.RUNNING, SESSION_STATUS.PAUSED] },
  })
    .populate('machine', 'machineId name location')
    .populate('booking', 'startTime endTime durationMinutes');

  if (!session) {
    return sendResponse(res, 200, true, 'No active session.', { session: null });
  }

  // Calculate remaining time
  const now = new Date();
  const effectiveEnd = session.extendedEndAt || session.scheduledEndAt;
  const remainingMs = effectiveEnd.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

  sendResponse(res, 200, true, 'Active session retrieved.', {
    session,
    remainingMinutes,
    effectiveEndTime: effectiveEnd,
  });
});

/**
 * @desc    Extend session by 5 minutes
 * @route   POST /api/sessions/:id/extend
 * @access  Private (User)
 */
const extendSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id).populate('machine');

  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  // Verify ownership
  if (session.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized.', 403);
  }

  // Check session is running
  if (session.status !== SESSION_STATUS.RUNNING) {
    throw new AppError('Can only extend a running session.', 400);
  }

  // Check if already extended
  if (session.extensionGranted) {
    throw new AppError('Extension already used for this session. Only one extension allowed.', 400);
  }

  const extensionMinutes = parseInt(process.env.EXTENSION_MINUTES) || 5;
  const currentEnd = session.extendedEndAt || session.scheduledEndAt;
  const newEnd = addMinutes(currentEnd, extensionMinutes);

  // Check if the extended time conflicts with next booking
  const available = await isSlotAvailable(session.machine._id, currentEnd, newEnd, session.booking);
  if (!available) {
    throw new AppError(
      'Cannot extend — the next slot is already booked. Extension would conflict.',
      409
    );
  }

  session.extensionGranted = true;
  session.extensionMinutes = extensionMinutes;
  session.extendedEndAt = newEnd;
  await session.save();

  // Update booking end time
  await Booking.findByIdAndUpdate(session.booking, { endTime: newEnd });

  // Notification
  await createNotification(
    session.user,
    NOTIFICATION_TYPES.EXTENSION_GRANTED,
    'Extension Granted',
    `Your session has been extended by ${extensionMinutes} minutes. New end time: ${newEnd.toLocaleTimeString()}.`,
    { sessionId: session._id }
  );

  sendResponse(res, 200, true, `Session extended by ${extensionMinutes} minutes.`, {
    session,
    newEndTime: newEnd,
  });
});

/**
 * @desc    End/complete a session
 * @route   POST /api/sessions/:id/end
 * @access  Private (User, Warden, Admin, System)
 */
const endSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);

  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  // Authorization: user can end own session, warden/admin can end any
  if (
    req.user.role === 'user' &&
    session.user.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Not authorized.', 403);
  }

  if (
    session.status !== SESSION_STATUS.RUNNING &&
    session.status !== SESSION_STATUS.PAUSED
  ) {
    throw new AppError(`Cannot end session with status: ${session.status}.`, 400);
  }

  const now = new Date();
  session.status = SESSION_STATUS.COMPLETED;
  session.actualEndAt = now;
  session.powerOffAt = now;
  session.terminatedBy = req.user.role === 'user' ? 'user' : req.user.role;
  session.durationMinutes = Math.round(diffInMinutes(session.startedAt, now));
  await session.save();

  // Update booking
  await Booking.findByIdAndUpdate(session.booking, {
    status: BOOKING_STATUS.COMPLETED,
  });

  // Free up machine
  const machine = await Machine.findById(session.machine);
  machine.status = MACHINE_STATUS.AVAILABLE;
  machine.currentBooking = null;
  machine.currentSession = null;
  machine.totalUsageCount += 1;
  machine.totalUsageMinutes += session.durationMinutes;
  await machine.save();

  // Notification
  await createNotification(
    session.user,
    NOTIFICATION_TYPES.SESSION_COMPLETED,
    'Session Completed',
    `Your washing session is complete. Duration: ${session.durationMinutes} minutes.`,
    { sessionId: session._id }
  );

  sendResponse(res, 200, true, 'Session ended successfully.', { session });
});

/**
 * @desc    Pause a session (for issues)
 * @route   POST /api/sessions/:id/pause
 * @access  Private (Warden, Admin)
 */
const pauseSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);

  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  if (session.status !== SESSION_STATUS.RUNNING) {
    throw new AppError('Can only pause a running session.', 400);
  }

  session.status = SESSION_STATUS.PAUSED;
  session.pausedAt = new Date();
  await session.save();

  sendResponse(res, 200, true, 'Session paused.', { session });
});

/**
 * @desc    Resume a paused session
 * @route   POST /api/sessions/:id/resume
 * @access  Private (Warden, Admin)
 */
const resumeSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);

  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  if (session.status !== SESSION_STATUS.PAUSED) {
    throw new AppError('Can only resume a paused session.', 400);
  }

  const now = new Date();
  const pausedDuration = diffInMinutes(session.pausedAt, now);

  session.status = SESSION_STATUS.RUNNING;
  session.resumedAt = now;
  session.totalPausedMinutes += Math.round(pausedDuration);

  // Extend the scheduled end time by the paused duration
  const currentEnd = session.extendedEndAt || session.scheduledEndAt;
  session.extendedEndAt = addMinutes(currentEnd, pausedDuration);

  await session.save();

  // Update booking end time
  await Booking.findByIdAndUpdate(session.booking, {
    endTime: session.extendedEndAt,
  });

  sendResponse(res, 200, true, 'Session resumed.', {
    session,
    pausedMinutes: Math.round(pausedDuration),
    newEndTime: session.extendedEndAt,
  });
});

/**
 * @desc    Force stop a session (Warden/Admin)
 * @route   POST /api/sessions/:id/force-stop
 * @access  Private (Warden, Admin)
 */
const forceStopSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);

  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  if (
    session.status !== SESSION_STATUS.RUNNING &&
    session.status !== SESSION_STATUS.PAUSED
  ) {
    throw new AppError(`Cannot force stop session with status: ${session.status}.`, 400);
  }

  const now = new Date();
  session.status = SESSION_STATUS.TERMINATED;
  session.actualEndAt = now;
  session.powerOffAt = now;
  session.terminatedBy = req.user.role;
  session.durationMinutes = Math.round(diffInMinutes(session.startedAt, now));
  await session.save();

  // Update booking
  await Booking.findByIdAndUpdate(session.booking, {
    status: BOOKING_STATUS.INTERRUPTED,
  });

  // Free machine
  await Machine.findByIdAndUpdate(session.machine, {
    status: MACHINE_STATUS.AVAILABLE,
    currentBooking: null,
    currentSession: null,
  });

  // Notify user
  await createNotification(
    session.user,
    NOTIFICATION_TYPES.MAINTENANCE_ALERT,
    'Session Force Stopped',
    `Your session was stopped by ${req.user.role}. Please contact the warden for assistance.`,
    { sessionId: session._id }
  );

  sendResponse(res, 200, true, 'Session force stopped.', { session });
});

/**
 * @desc    Get session history for current user
 * @route   GET /api/sessions/history
 * @access  Private (User)
 */
const getSessionHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const total = await Session.countDocuments({ user: req.user._id });
  const sessions = await Session.find({ user: req.user._id })
    .populate('machine', 'machineId name location')
    .populate('booking', 'startTime endTime durationMinutes')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  sendResponse(res, 200, true, 'Session history retrieved.', {
    sessions,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * @desc    Get all sessions (Warden/Admin)
 * @route   GET /api/sessions/all
 * @access  Private (Warden, Admin)
 */
const getAllSessions = asyncHandler(async (req, res) => {
  const { status, machineId, page = 1, limit = 50 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (machineId) {
    const machine = await Machine.findOne({ machineId });
    if (machine) query.machine = machine._id;
  }

  const total = await Session.countDocuments(query);
  const sessions = await Session.find(query)
    .populate('machine', 'machineId name location')
    .populate('user', 'name email phone roomNumber')
    .populate('booking', 'startTime endTime')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  sendResponse(res, 200, true, 'All sessions retrieved.', {
    sessions,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    },
  });
});

module.exports = {
  startSession,
  getActiveSession,
  extendSession,
  endSession,
  pauseSession,
  resumeSession,
  forceStopSession,
  getSessionHistory,
  getAllSessions,
};
