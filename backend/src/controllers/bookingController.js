// ============================================
// LUNEX — Booking Controller
// ============================================
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const BookingLock = require('../models/BookingLock');
const UserDailyBookingCounter = require('../models/UserDailyBookingCounter');
const Machine = require('../models/Machine');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const { BOOKING_STATUS, MACHINE_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const { addMinutes, startOfDay, endOfDay, isPast } = require('../utils/dateHelpers');
const {
  getSlotBufferMinutes,
} = require('../services/bookingService');
const { getNumericSystemConfig } = require('../services/systemConfigService');
const { createNotification } = require('../services/notificationService');

const TRANSACTION_OPTIONS = {
  readPreference: 'primary',
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority', j: true },
};

const floorToMinute = (date) => {
  const value = new Date(date);
  value.setSeconds(0, 0);
  return value;
};

const buildBookingLocks = (machineId, bookingId, startTime, endTime) => {
  const locks = [];
  let cursor = floorToMinute(startTime);
  const end = floorToMinute(endTime);

  while (cursor < end) {
    locks.push({
      machine: machineId,
      booking: bookingId,
      lockTime: new Date(cursor),
    });
    cursor = addMinutes(cursor, 1);
  }

  return locks;
};

/**
 * @desc    Create a new booking
 * @route   POST /api/bookings
 * @access  Private (User)
 */
const createBooking = asyncHandler(async (req, res) => {
  const { machineId, startTime, durationMinutes } = req.body;
  const userId = req.user._id;

  const bookingStart = new Date(startTime);
  if (isPast(bookingStart)) {
    throw new AppError('Cannot book a slot in the past.', 400);
  }
  const maxAdvanceDays = await getNumericSystemConfig({
    key: 'max_advance_booking_days',
    envKey: 'MAX_ADVANCE_BOOKING_DAYS',
    fallback: 7,
    min: 1,
  });
  const maxDate = addMinutes(new Date(), maxAdvanceDays * 24 * 60);
  if (bookingStart > maxDate) {
    throw new AppError(`Cannot book more than ${maxAdvanceDays} days in advance.`, 400);
  }
  const bookingEnd = addMinutes(bookingStart, durationMinutes);
  const maxBookings = await getNumericSystemConfig({
    key: 'max_bookings_per_day',
    envKey: 'MAX_BOOKINGS_PER_DAY',
    fallback: 3,
    min: 1,
  });

  const slotDate = startOfDay(bookingStart);
  const bookingId = new mongoose.Types.ObjectId();
  let machineForNotification = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new AppError('User not found.', 404);
      }
      if (!user.rfidUID) {
        throw new AppError('RFID not assigned. Contact admin to get your RFID card.', 400);
      }

      const machine = await Machine.findOne({ machineId }).session(session);
      if (!machine) {
        throw new AppError('Machine not found.', 404);
      }

      if (machine.status === MACHINE_STATUS.MAINTENANCE) {
        throw new AppError('Machine is under maintenance.', 400);
      }
      if (machine.status === MACHINE_STATUS.REPAIR) {
        throw new AppError('Machine is under repair.', 400);
      }
      if (machine.status === MACHINE_STATUS.DISABLED) {
        throw new AppError('Machine is disabled.', 400);
      }

      machineForNotification = machine;

      const userConflict = await Booking.findOne({
        user: userId,
        status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ACTIVE] },
        startTime: { $lt: bookingEnd },
        endTime: { $gt: bookingStart },
      }).session(session);
      if (userConflict) {
        throw new AppError('You already have a booking during this time.', 409);
      }

      const counterUpdated = await UserDailyBookingCounter.updateOne(
        {
          user: userId,
          slotDate,
          count: { $lt: maxBookings },
        },
        {
          $inc: { count: 1 },
        },
        { session }
      );

      if (counterUpdated.modifiedCount === 0) {
        const [createdCounter] = await UserDailyBookingCounter.create(
          [
            {
              user: userId,
              slotDate,
              count: 1,
            },
          ],
          { session }
        ).catch((error) => {
          if (error?.code === 11000) {
            return [null];
          }
          throw error;
        });

        if (!createdCounter) {
          const retriedCounter = await UserDailyBookingCounter.updateOne(
            {
              user: userId,
              slotDate,
              count: { $lt: maxBookings },
            },
            {
              $inc: { count: 1 },
            },
            { session }
          );

          if (retriedCounter.modifiedCount === 0) {
            throw new AppError(`Maximum ${maxBookings} bookings per day reached.`, 400);
          }
        }
      }

      const bufferMinutes = await getSlotBufferMinutes();
      const lockStart = addMinutes(bookingStart, -bufferMinutes);
      const lockEnd = addMinutes(bookingEnd, bufferMinutes);
      const lockDocs = buildBookingLocks(machine._id, bookingId, lockStart, lockEnd);

      try {
        await BookingLock.insertMany(lockDocs, { session, ordered: true });
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError('Selected time slot is not available. Please choose a different time.', 409);
        }
        throw error;
      }

      await Booking.create(
        [
          {
            _id: bookingId,
            user: userId,
            machine: machine._id,
            slotDate,
            startTime: bookingStart,
            endTime: bookingEnd,
            durationMinutes,
            status: BOOKING_STATUS.CONFIRMED,
          },
        ],
        { session }
      );

      const userUpdate = await User.updateOne(
        { _id: userId },
        { $inc: { totalBookings: 1 } },
        { session }
      );

      if (userUpdate.modifiedCount === 0) {
        throw new AppError('Booking could not be finalized for the user.', 409);
      }
    }, TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }

  const booking = await Booking.findById(bookingId);

  await createNotification(
    userId,
    NOTIFICATION_TYPES.BOOKING_CONFIRMED,
    'Booking Confirmed',
    `Your slot on ${machineForNotification?.name || machineId} has been booked.`,
    {
      bookingId: bookingId,
      machineId: machineForNotification?.machineId || machineId,
      machineName: machineForNotification?.name || machineId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      durationMinutes: booking?.durationMinutes,
    }
  );

  const populatedBooking = await Booking.findById(bookingId)
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
  const session = await mongoose.startSession();
  let booking = null;

  try {
    await session.withTransaction(async () => {
      booking = await Booking.findById(req.params.id).session(session);

      if (!booking) {
        throw new AppError('Booking not found.', 404);
      }

      if (
        req.user.role === 'user' &&
        booking.user.toString() !== req.user._id.toString()
      ) {
        throw new AppError('Not authorized to cancel this booking.', 403);
      }

      if (booking.status !== BOOKING_STATUS.CONFIRMED) {
        throw new AppError(`Cannot cancel a booking with status: ${booking.status}.`, 400);
      }

      const cancelledAt = new Date();
      const bookingUpdated = await Booking.updateOne(
        {
          _id: booking._id,
          status: BOOKING_STATUS.CONFIRMED,
        },
        {
          $set: {
            status: BOOKING_STATUS.CANCELLED,
            cancelledAt,
            cancelReason: req.body.reason || 'Cancelled by user',
          },
        },
        { session }
      );

      if (bookingUpdated.modifiedCount === 0) {
        throw new AppError('Booking cancellation failed due to concurrent update.', 409);
      }

      await BookingLock.deleteMany({ booking: booking._id }, { session });

      await UserDailyBookingCounter.updateOne(
        {
          user: booking.user,
          slotDate: booking.slotDate,
          count: { $gt: 0 },
        },
        {
          $inc: { count: -1 },
        },
        { session }
      );

      await UserDailyBookingCounter.deleteOne(
        {
          user: booking.user,
          slotDate: booking.slotDate,
          count: { $lte: 0 },
        },
        { session }
      );

      booking.status = BOOKING_STATUS.CANCELLED;
      booking.cancelledAt = cancelledAt;
      booking.cancelReason = req.body.reason || 'Cancelled by user';
    }, TRANSACTION_OPTIONS);
  } finally {
    await session.endSession();
  }

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

  const bufferMinutes = await getSlotBufferMinutes();

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
