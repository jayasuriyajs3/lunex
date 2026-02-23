// ============================================
// LUNEX — RFID Controller
// ============================================
const User = require('../models/User');
const Booking = require('../models/Booking');
const Machine = require('../models/Machine');
const Session = require('../models/Session');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const {
  BOOKING_STATUS,
  MACHINE_STATUS,
  SESSION_STATUS,
  ACCOUNT_STATUS,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const { addMinutes, diffInMinutes } = require('../utils/dateHelpers');
const { createNotification } = require('../services/notificationService');

/**
 * @desc    Validate RFID scan from ESP32
 * @route   POST /api/rfid/scan
 * @access  Public (from ESP32 hardware)
 *
 * Flow:
 * 1. ESP32 reads RFID card
 * 2. Sends UID + machineId to this endpoint
 * 3. Server validates user, checks booking, starts/ends session
 * 4. Returns action: allow/deny + instructions
 */
const scanRFID = asyncHandler(async (req, res) => {
  const { rfidUID, machineId } = req.body;

  if (!rfidUID || !machineId) {
    throw new AppError('RFID UID and Machine ID are required.', 400);
  }

  // Check for master RFID (offline/emergency access)
  if (rfidUID === process.env.MASTER_RFID_UID) {
    return sendResponse(res, 200, true, 'Master RFID access granted.', {
      action: 'MASTER_ACCESS',
      powerOn: true,
      duration: 60,
    });
  }

  // 1. Find user by RFID
  const user = await User.findOne({ rfidUID });
  if (!user) {
    return sendResponse(res, 403, false, 'RFID not recognized.', {
      action: 'DENY',
      reason: 'UNKNOWN_RFID',
      buzzer: 'error',
    });
  }

  // 2. Check user account status
  if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
    return sendResponse(res, 403, false, 'Account not active.', {
      action: 'DENY',
      reason: 'INACTIVE_ACCOUNT',
      buzzer: 'error',
    });
  }

  // 3. Find the machine
  const machine = await Machine.findOne({ machineId });
  if (!machine) {
    return sendResponse(res, 404, false, 'Machine not found.', {
      action: 'DENY',
      reason: 'UNKNOWN_MACHINE',
    });
  }

  // 4. Check if machine is in maintenance/repair
  if (
    [MACHINE_STATUS.MAINTENANCE, MACHINE_STATUS.REPAIR, MACHINE_STATUS.DISABLED].includes(
      machine.status
    )
  ) {
    return sendResponse(res, 400, false, `Machine is ${machine.status}.`, {
      action: 'DENY',
      reason: 'MACHINE_UNAVAILABLE',
      buzzer: 'error',
    });
  }

  // 5. If machine is IN_USE — check if this user is ending their session
  if (machine.status === MACHINE_STATUS.IN_USE && machine.currentSession) {
    const activeSession = await Session.findById(machine.currentSession);

    if (activeSession && activeSession.user.toString() === user._id.toString()) {
      // User is ending their session via RFID scan
      const now = new Date();
      activeSession.status = SESSION_STATUS.COMPLETED;
      activeSession.actualEndAt = now;
      activeSession.powerOffAt = now;
      activeSession.terminatedBy = 'user';
      activeSession.durationMinutes = Math.round(diffInMinutes(activeSession.startedAt, now));
      await activeSession.save();

      await Booking.findByIdAndUpdate(activeSession.booking, {
        status: BOOKING_STATUS.COMPLETED,
      });

      machine.status = MACHINE_STATUS.AVAILABLE;
      machine.currentBooking = null;
      machine.currentSession = null;
      machine.totalUsageCount += 1;
      machine.totalUsageMinutes += activeSession.durationMinutes;
      await machine.save();

      await createNotification(
        user._id,
        NOTIFICATION_TYPES.SESSION_COMPLETED,
        'Session Completed',
        `Your session ended. Duration: ${activeSession.durationMinutes} minutes.`,
        { sessionId: activeSession._id }
      );

      return sendResponse(res, 200, true, 'Session ended.', {
        action: 'POWER_OFF',
        powerOn: false,
        sessionDuration: activeSession.durationMinutes,
        buzzer: 'success',
        display: 'Session Complete',
      });
    } else {
      // Different user — machine is busy
      return sendResponse(res, 400, false, 'Machine is currently in use by another user.', {
        action: 'DENY',
        reason: 'MACHINE_IN_USE',
        buzzer: 'error',
        display: 'Machine Busy',
      });
    }
  }

  // 6. Machine is available — check if user has a valid booking
  const now = new Date();
  const graceMinutes = parseInt(process.env.GRACE_PERIOD_MINUTES) || 10;

  // Find a confirmed booking for this user & machine within the grace window
  const booking = await Booking.findOne({
    user: user._id,
    machine: machine._id,
    status: BOOKING_STATUS.CONFIRMED,
    startTime: {
      $lte: addMinutes(now, graceMinutes), // Can arrive up to grace period early
    },
    endTime: {
      $gte: now, // Booking hasn't ended yet
    },
  }).sort({ startTime: 1 });

  if (!booking) {
    return sendResponse(res, 403, false, 'No valid booking found for this machine.', {
      action: 'DENY',
      reason: 'NO_BOOKING',
      buzzer: 'error',
      display: 'No Booking',
    });
  }

  // 7. Start the session
  const session = await Session.create({
    booking: booking._id,
    user: user._id,
    machine: machine._id,
    status: SESSION_STATUS.RUNNING,
    startedAt: now,
    scheduledEndAt: booking.endTime,
    powerOnAt: now,
  });

  // Update booking
  booking.status = BOOKING_STATUS.ACTIVE;
  booking.rfidScannedAt = now;
  booking.arrivedAt = now;
  booking.session = session._id;
  await booking.save();

  // Update machine
  machine.status = MACHINE_STATUS.IN_USE;
  machine.currentBooking = booking._id;
  machine.currentSession = session._id;
  await machine.save();

  // Increment user session count
  await User.findByIdAndUpdate(user._id, { $inc: { totalSessions: 1 } });

  // Calculate duration for ESP32
  const remainingMinutes = Math.ceil(diffInMinutes(now, booking.endTime));

  await createNotification(
    user._id,
    NOTIFICATION_TYPES.SESSION_STARTED,
    'Session Started',
    `Machine ${machine.name} is now ON. Your session will run for ${remainingMinutes} minutes.`,
    { sessionId: session._id, bookingId: booking._id }
  );

  sendResponse(res, 200, true, 'Access granted. Session started.', {
    action: 'POWER_ON',
    powerOn: true,
    duration: remainingMinutes,
    sessionId: session._id,
    bookingId: booking._id,
    userName: user.name,
    buzzer: 'success',
    display: `Welcome ${user.name.split(' ')[0]}`,
  });
});

/**
 * @desc    Validate RFID UID (for admin assignment verification)
 * @route   POST /api/rfid/validate
 * @access  Private (Admin)
 */
const validateRFID = asyncHandler(async (req, res) => {
  const { rfidUID } = req.body;

  if (!rfidUID) {
    throw new AppError('RFID UID is required.', 400);
  }

  const existingUser = await User.findOne({ rfidUID });

  sendResponse(res, 200, true, 'RFID validation result.', {
    isAssigned: !!existingUser,
    assignedTo: existingUser
      ? { id: existingUser._id, name: existingUser.name, email: existingUser.email }
      : null,
  });
});

module.exports = {
  scanRFID,
  validateRFID,
};
