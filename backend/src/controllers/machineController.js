// ============================================
// LUNEX — Machine Controller
// ============================================
const Machine = require('../models/Machine');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const {
  MACHINE_STATUS,
  BOOKING_STATUS,
  SESSION_STATUS,
  NOTIFICATION_TYPES,
} = require('../config/constants');
const { createNotification, createBulkNotifications } = require('../services/notificationService');

/**
 * @desc    Create a new machine (Admin only)
 * @route   POST /api/machines
 * @access  Private (Admin)
 */
const createMachine = asyncHandler(async (req, res) => {
  const { machineId, name, location, esp32Ip, relayPin } = req.body;

  const existingMachine = await Machine.findOne({ machineId });
  if (existingMachine) {
    throw new AppError('Machine with this ID already exists.', 409);
  }

  const machine = await Machine.create({
    machineId,
    name,
    location,
    esp32Ip,
    relayPin,
    addedBy: req.user._id,
  });

  sendResponse(res, 201, true, 'Machine created successfully.', { machine });
});

/**
 * @desc    Get all machines
 * @route   GET /api/machines
 * @access  Private
 */
const getAllMachines = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status) query.status = status;

  const machines = await Machine.find(query)
    .populate('currentBooking', 'startTime endTime user')
    .populate('currentSession', 'status startedAt scheduledEndAt');

  sendResponse(res, 200, true, 'Machines retrieved.', { machines });
});

/**
 * @desc    Get machine by ID
 * @route   GET /api/machines/:machineId
 * @access  Private
 */
const getMachineById = asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ machineId: req.params.machineId })
    .populate('currentBooking')
    .populate('currentSession');

  if (!machine) {
    throw new AppError('Machine not found.', 404);
  }

  sendResponse(res, 200, true, 'Machine retrieved.', { machine });
});

/**
 * @desc    Update machine details (Admin only)
 * @route   PUT /api/machines/:machineId
 * @access  Private (Admin)
 */
const updateMachine = asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ machineId: req.params.machineId });
  if (!machine) {
    throw new AppError('Machine not found.', 404);
  }

  const allowedFields = ['name', 'location', 'esp32Ip', 'relayPin'];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      machine[field] = req.body[field];
    }
  });

  await machine.save();

  sendResponse(res, 200, true, 'Machine updated.', { machine });
});

/**
 * @desc    Update machine status (Warden/Admin)
 * @route   PUT /api/machines/:machineId/status
 * @access  Private (Warden, Admin)
 */
const updateMachineStatus = asyncHandler(async (req, res) => {
  const { status, maintenanceNote } = req.body;

  const machine = await Machine.findOne({ machineId: req.params.machineId });
  if (!machine) {
    throw new AppError('Machine not found.', 404);
  }

  const previousStatus = machine.status;

  // If setting to maintenance/repair/disabled, handle active bookings
  if (
    [MACHINE_STATUS.MAINTENANCE, MACHINE_STATUS.REPAIR, MACHINE_STATUS.DISABLED].includes(status)
  ) {
    // Cancel all upcoming confirmed bookings
    const upcomingBookings = await Booking.find({
      machine: machine._id,
      status: BOOKING_STATUS.CONFIRMED,
      startTime: { $gte: new Date() },
    }).populate('user', 'name');

    if (upcomingBookings.length > 0) {
      const userIds = upcomingBookings.map((b) => b.user._id);

      await Booking.updateMany(
        {
          _id: { $in: upcomingBookings.map((b) => b._id) },
        },
        {
          status: BOOKING_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: `Machine set to ${status} by ${req.user.role}`,
        }
      );

      // Notify affected users
      await createBulkNotifications(
        userIds,
        NOTIFICATION_TYPES.MAINTENANCE_ALERT,
        'Booking Cancelled',
        `Your booking on ${machine.name} has been cancelled due to ${status}. Please rebook on another machine.`,
        { machineId: machine.machineId, reason: status }
      );
    }

    // If there's an active session, interrupt it
    if (machine.currentSession) {
      const session = await Session.findById(machine.currentSession);
      if (session && session.status === SESSION_STATUS.RUNNING) {
        session.status = SESSION_STATUS.INTERRUPTED;
        session.actualEndAt = new Date();
        session.terminatedBy = req.user.role;
        await session.save();

        // Update associated booking
        await Booking.findByIdAndUpdate(session.booking, {
          status: BOOKING_STATUS.INTERRUPTED,
        });

        // Notify the user
        await createNotification(
          session.user,
          NOTIFICATION_TYPES.MAINTENANCE_ALERT,
          'Session Interrupted',
          `Your session on ${machine.name} was interrupted due to ${status}.`,
          { machineId: machine.machineId, sessionId: session._id }
        );
      }
    }

    machine.maintenanceNote = maintenanceNote || '';
    machine.lastMaintenanceDate = new Date();
    machine.currentBooking = null;
    machine.currentSession = null;
  }

  machine.status = status;
  await machine.save();

  sendResponse(res, 200, true, `Machine status updated to '${status}'.`, {
    machine,
    previousStatus,
  });
});

/**
 * @desc    Delete machine (Admin only)
 * @route   DELETE /api/machines/:machineId
 * @access  Private (Admin)
 */
const deleteMachine = asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ machineId: req.params.machineId });
  if (!machine) {
    throw new AppError('Machine not found.', 404);
  }

  // Don't delete if machine has active sessions
  if (machine.status === MACHINE_STATUS.IN_USE) {
    throw new AppError('Cannot delete a machine that is currently in use.', 400);
  }

  await Machine.findByIdAndDelete(machine._id);

  sendResponse(res, 200, true, 'Machine deleted successfully.');
});

/**
 * @desc    ESP32 heartbeat endpoint
 * @route   POST /api/machines/:machineId/heartbeat
 * @access  Public (from ESP32)
 */
const heartbeat = asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ machineId: req.params.machineId });
  if (!machine) {
    throw new AppError('Machine not found.', 404);
  }

  machine.isOnline = true;
  machine.lastHeartbeat = new Date();
  await machine.save();

  sendResponse(res, 200, true, 'Heartbeat received.', {
    machineStatus: machine.status,
    currentSession: machine.currentSession,
  });
});

module.exports = {
  createMachine,
  getAllMachines,
  getMachineById,
  updateMachine,
  updateMachineStatus,
  deleteMachine,
  heartbeat,
};
