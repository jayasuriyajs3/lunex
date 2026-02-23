// ============================================
// LUNEX — Machine Validation Schemas
// ============================================
const Joi = require('joi');
const { MACHINE_STATUS } = require('../config/constants');

const createMachineSchema = Joi.object({
  machineId: Joi.string().trim().required().messages({
    'any.required': 'Machine ID is required',
  }),
  name: Joi.string().trim().required().messages({
    'any.required': 'Machine name is required',
  }),
  location: Joi.string().trim().required().messages({
    'any.required': 'Location is required',
  }),
  esp32Ip: Joi.string().trim().optional(),
  relayPin: Joi.number().integer().optional(),
});

const updateMachineStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(MACHINE_STATUS))
    .required()
    .messages({
      'any.only': `Status must be one of: ${Object.values(MACHINE_STATUS).join(', ')}`,
      'any.required': 'Status is required',
    }),
  maintenanceNote: Joi.string().trim().max(500).optional(),
});

const updateMachineSchema = Joi.object({
  name: Joi.string().trim().optional(),
  location: Joi.string().trim().optional(),
  esp32Ip: Joi.string().trim().optional(),
  relayPin: Joi.number().integer().optional(),
});

module.exports = {
  createMachineSchema,
  updateMachineStatusSchema,
  updateMachineSchema,
};
