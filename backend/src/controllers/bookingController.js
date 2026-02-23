// ============================================
// LUNEX — Booking Controller
// ============================================
const Booking = require('../models/Booking');
const Machine = require('../models/Machine');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const { BOOKING_STATUS, MACHINE_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const { addMinutes, startOfDay, endOfDay, isPast } = require('../utils/dateHelpers');
const { isSlotAvailable, getUserBookingCountForDate } = require('../services/bookingService');
const { createNotification } = require('../services/notificationService');

/**
 * @desc    Create a new booking
 * @route   POST /api/bookings
 * @access  Private (User)
 */
const createBooking = asyncHandler(async (req, res) => {
  const { machineId, startTime, durationMinutes } = req.body;
  const userId = req.user._id;

  // 1. Validate user has RFID assigned
  if (!req.user.rfidUID) {
    throw new AppError('RFID not assigned. Contact admin to get your RFID card.', 400);
  }

  // 2. Find machine by machineId string
  const machine = await Machine.findOne({ machineId });
  if (!machine) {
    throw new AppError('Machine not found.', 404);
  }

  // 3. Check machine is available (not in maintenance/repair/disabled)
  if (machine.status === MACHINE_STATUS.MAINTENANCE) {
    throw new AppError('Machine is under maintenance.', 400);
  }
  if (machine.status === MACHINE_STATUS.REPAIR) {
    throw new AppError('Machine is under repair.', 400);
  }
  if (machine.status === MACHINE_STATUS.DISABLED) {
    throw new AppError('Machine is disabled.', 400);
  }

  // 4. Validate start time is in the future
  const bookingStart = new Date(startTime);
  if (isPast(bookingStart)) {
    throw new AppError('Cannot book a slot in the past.', 400);
  }

  // 5. Check advance booking limit
  const maxAdvanceDays = parseInt(process.env.MAX_ADVANCE_BOOKING_DAYS) || 7;
  const maxDate = addMinutes(new Date(), maxAdvanceDays * 24 * 60);
  if (bookingStart > maxDate) {
    throw new AppError(`Cannot book more than ${maxAdvanceDays} days in advance.`, 400);
  }

  // 6. Calculate end time
  const bookingEnd = addMinutes(bookingStart, durationMinutes);

  // 7. Check user's daily booking limit
  const maxBookings = parseInt(process.env.MAX_BOOKINGS_PER_DAY) || 3;
  const dailyCount = await getUserBookingCountForDate(userId, bookingStart);
  if (dailyCount >= maxBookings) {
    throw new AppError(`Maximum ${maxBookings} bookings per day reached.`, 400);
  }

  // 8. Check slot availability (with buffer)
  const available = await isSlotAvailable(machine._id, bookingStart, bookingEnd);
  if (!available) {
    throw new AppError('Selected time slot is not available. Please choose a different time.', 409);
  }

  // 9. Check if user already has an active/confirmed booking at this time
  const userConflict = await Booking.findOne({
    user: userId,
    status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ACTIVE] },
    startTime: { $lt: bookingEnd },
    endTime: { $gt: bookingStart },
  });
  if (userConflict) {
    throw new AppError('You already have a booking during this time.', 409);
  }

  // 10. Create booking
  const booking = await Booking.create({
    user: userId,
    machine: machine._id,
    slotDate: startOfDay(bookingStart),
    startTime: bookingStart,
    endTime: bookingEnd,
    durationMinutes,
    status: BOOKING_STATUS.CONFIRMED,
  });

  // 11. Increment user's total bookings
  await User.findByIdAndUpdate(userId, { $inc: { totalBookings: 1 } });

  // 12. Send confirmation notification
  await createNotification(
    userId,
    NOTIFICATION_TYPES.BOOKING_CONFIRMED,
    'Booking Confirmed',
    `Your slot on ${machine.name} is booked from ${bookingStart.toLocaleTimeString()} to ${bookingEnd.toLocaleTimeString()}.`,
    { bookingId: booking._id, machineId: machine.machineId }
  );

  // Populate response
  const populatedBooking = await Booking.findById(booking._id)
    .populate('machine', 'machineId name location')
    .populate('user', 'name email');

  sendResponse(res, 201, true, 'Booking created successfully.', { booking: populatedBooking });
});

/**
 * @desc    Get my bookings
 * @route   GET /api/bookings/my
 * @access  Private (User)
 */
const getMyBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const query = { user: req.user._id };
  if (status) {
    query.status = status;
  }

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate('machine', 'machineId name location status')
    .sort({ startTime: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  sendResponse(res, 200, true, 'Bookings retrieved.', {
    bookings,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * @desc    Get booking by ID
 * @route   GET /api/bookings/:id
 * @access  Private
 */
const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('machine', 'machineId name location status')
    .populate('user', 'name email phone roomNumber hostelBlock')
    .populate('session');

  if (!booking) {
    throw new AppError('Booking not found.', 404);
  }

  // Users can only view their own bookings; wardens/admins can view all
  if (
    req.user.role === 'user' &&
    booking.user._id.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Not authorized to view this booking.', 403);
  }

  sendResponse(res, 200, true, 'Booking retrieved.', { booking });
});

/**
 * @desc    Cancel a booking
 * @route   PUT /api/bookings/:id/cancel
 * @access  Private (User)
 */
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw new AppError('Booking not found.', 404);
  }

  // Only the booking owner can cancel (or admin/warden)
  if (
    req.user.role === 'user' &&
    booking.user.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Not authorized to cancel this booking.', 403);
  }

  // Can only cancel confirmed bookings
  if (booking.status !== BOOKING_STATUS.CONFIRMED) {
    throw new AppError(`Cannot cancel a booking with status: ${booking.status}.`, 400);
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledAt = new Date();
  booking.cancelReason = req.body.reason || 'Cancelled by user';
  await booking.save();

  sendResponse(res, 200, true, 'Booking cancelled successfully.', { booking });
});

/**
 * @desc    Get available slots for a machine on a date
 * @route   GET /api/bookings/slots/:machineId/:date
 * @access  Private
 */
const getAvailableSlots = asyncHandler(async (req, res) => {
  const { machineId, date } = req.params;

  const machine = await Machine.findOne({ machineId });
  if (!machine) {
    throw new AppError('Machine not found.', 404);
  }

  const targetDate = new Date(date);
  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  // Get all confirmed/active bookings for this machine on this date
  const bookings = await Booking.find({
    machine: machine._id,
    status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ACTIVE] },
    startTime: { $gte: dayStart, $lte: dayEnd },
  })
    .sort({ startTime: 1 })
    .select('startTime endTime durationMinutes status');

  const bufferMinutes = parseInt(process.env.BUFFER_BETWEEN_SLOTS_MINUTES) || 10;

  // Generate occupied time blocks (booking + buffer)
  const occupiedSlots = bookings.map((b) => ({
    startTime: b.startTime,
    endTime: addMinutes(b.endTime, bufferMinutes),
    bookingId: b._id,
    status: b.status,
  }));

  sendResponse(res, 200, true, 'Slots retrieved.', {
    machine: {
      machineId: machine.machineId,
      name: machine.name,
      location: machine.location,
      status: machine.status,
    },
    date: date,
    bookedSlots: bookings,
    occupiedBlocks: occupiedSlots,
    bufferMinutes,
  });
});

/**
 * @desc    Get all bookings (warden/admin)
 * @route   GET /api/bookings/all
 * @access  Private (Warden, Admin)
 */
const getAllBookings = asyncHandler(async (req, res) => {
  const { status, machineId, date, page = 1, limit = 50 } = req.query;

  const query = {};

  if (status) query.status = status;
  if (date) {
    query.slotDate = {
      $gte: startOfDay(new Date(date)),
      $lte: endOfDay(new Date(date)),
    };
  }

  if (machineId) {
    const machine = await Machine.findOne({ machineId });
    if (machine) query.machine = machine._id;
  }

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate('machine', 'machineId name location')
    .populate('user', 'name email phone roomNumber hostelBlock')
    .sort({ startTime: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  sendResponse(res, 200, true, 'All bookings retrieved.', {
    bookings,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    },
  });
});

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAvailableSlots,
  getAllBookings,
};
