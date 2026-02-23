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
  durationMinutes: Joi.number().integer().min(10).max(60).required().messages({
    'number.min': 'Duration must be at least 10 minutes',
    'number.max': 'Duration cannot exceed 60 minutes',
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
