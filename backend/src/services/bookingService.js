// ============================================
// LUNEX — Booking Service (shared logic)
// ============================================
const Booking = require('../models/Booking');
const Machine = require('../models/Machine');
const { BOOKING_STATUS, MACHINE_STATUS } = require('../config/constants');
const { addMinutes, isOverlapping } = require('../utils/dateHelpers');

/**
 * Check if a slot is available for a machine
 */
const isSlotAvailable = async (machineId, startTime, endTime, excludeBookingId = null) => {
  const bufferMinutes = parseInt(process.env.BUFFER_BETWEEN_SLOTS_MINUTES) || 10;

  // Add buffer: the slot effectively occupies startTime to endTime + buffer
  const bufferedEnd = addMinutes(endTime, bufferMinutes);
  const bufferedStart = new Date(startTime);

  const query = {
    machine: machineId,
    status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ACTIVE] },
    $or: [
      {
        // Check if any existing booking (with its buffer) overlaps our requested slot
        startTime: { $lt: bufferedEnd },
        endTime: { $gt: new Date(new Date(bufferedStart).getTime() - bufferMinutes * 60000) },
      },
    ],
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflicting = await Booking.findOne(query);
  return !conflicting;
};

/**
 * Get user's booking count for a specific date
 */
const getUserBookingCountForDate = async (userId, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return Booking.countDocuments({
    user: userId,
    slotDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: [BOOKING_STATUS.CANCELLED] },
  });
};

/**
 * Find next available slot for a machine
 */
const findNextAvailableSlot = async (machineId, durationMinutes, afterTime = new Date()) => {
  const bufferMinutes = parseInt(process.env.BUFFER_BETWEEN_SLOTS_MINUTES) || 10;

  // Get all upcoming confirmed/active bookings for this machine
  const bookings = await Booking.find({
    machine: machineId,
    status: { $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.ACTIVE] },
    endTime: { $gte: afterTime },
  }).sort({ startTime: 1 });

  // Try starting from afterTime (rounded up to next 5-min block)
  let candidateStart = new Date(afterTime);
  const mins = candidateStart.getMinutes();
  const roundUp = 5 - (mins % 5);
  if (roundUp < 5) candidateStart = addMinutes(candidateStart, roundUp);
  candidateStart.setSeconds(0, 0);

  for (const booking of bookings) {
    const candidateEnd = addMinutes(candidateStart, durationMinutes);

    // Check if candidate overlaps with this booking (including buffer)
    const bookingBufferedEnd = addMinutes(booking.endTime, bufferMinutes);
    const bookingBufferedStart = new Date(
      new Date(booking.startTime).getTime() - bufferMinutes * 60000
    );

    if (candidateStart < bookingBufferedEnd && candidateEnd > bookingBufferedStart) {
      // Conflict — move candidate start to after this booking + buffer
      candidateStart = addMinutes(booking.endTime, bufferMinutes);
    }
  }

  return {
    startTime: candidateStart,
    endTime: addMinutes(candidateStart, durationMinutes),
  };
};

module.exports = {
  isSlotAvailable,
  getUserBookingCountForDate,
  findNextAvailableSlot,
};
