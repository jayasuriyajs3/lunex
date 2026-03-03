// ============================================
// LUNEX — Booking Validation Schemas
// ============================================
const Joi = require('joi');

const createBookingSchema = Joi.object({
  machineId: Joi.string().required().messages({
    'any.required': 'Machine ID is required',
  }),
  startTime: Joi.date().iso().required().messages({
    'date.format': 'Start time must be a valid ISO date',
    'any.required': 'Start time is required',
  }),
  durationMinutes: Joi.number().integer().valid(15, 30, 45, 60).required().messages({
    'any.only': 'Duration must be one of: 15, 30, 45, or 60 minutes',
    'any.required': 'Duration is required',
  }),
});

const cancelBookingSchema = Joi.object({
  reason: Joi.string().max(200).optional(),
});

module.exports = {
  createBookingSchema,
  cancelBookingSchema,
};
