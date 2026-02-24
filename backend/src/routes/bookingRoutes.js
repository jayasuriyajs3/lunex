// ============================================
// LUNEX — Booking Routes
// ============================================
const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAvailableSlots,
  getAllBookings,
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { createBookingSchema, cancelBookingSchema } = require('../validators/bookingValidator');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(protect);

// User routes
router.post('/', authorize(ROLES.USER, ROLES.WARDEN, ROLES.ADMIN), validate(createBookingSchema), createBooking);
router.get('/my', authorize(ROLES.USER, ROLES.WARDEN, ROLES.ADMIN), getMyBookings);
router.get('/slots/:machineId/:date', getAvailableSlots);
router.get('/all', authorize(ROLES.WARDEN, ROLES.ADMIN), getAllBookings);
router.get('/:id', getBookingById);
router.put('/:id/cancel', validate(cancelBookingSchema), cancelBooking);

module.exports = router;
