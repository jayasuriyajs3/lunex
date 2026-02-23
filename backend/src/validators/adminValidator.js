// ============================================
// LUNEX — Admin Validation Schemas
// ============================================
const Joi = require('joi');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');

const approveUserSchema = Joi.object({
  userId: Joi.string().required().messages({
    'any.required': 'User ID is required',
  }),
});

const assignRfidSchema = Joi.object({
  userId: Joi.string().required().messages({
    'any.required': 'User ID is required',
  }),
  rfidUID: Joi.string().trim().required().messages({
    'any.required': 'RFID UID is required',
  }),
});

const blockUserSchema = Joi.object({
  userId: Joi.string().required().messages({
    'any.required': 'User ID is required',
  }),
});

const changeRoleSchema = Joi.object({
  userId: Joi.string().required().messages({
    'any.required': 'User ID is required',
  }),
  role: Joi.string()
    .valid(...Object.values(ROLES))
    .required()
    .messages({
      'any.only': `Role must be one of: ${Object.values(ROLES).join(', ')}`,
      'any.required': 'Role is required',
    }),
});

const resetPasswordSchema = Joi.object({
  userId: Joi.string().required().messages({
    'any.required': 'User ID is required',
  }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'New password is required',
  }),
});

const systemConfigSchema = Joi.object({
  key: Joi.string().trim().required().messages({
    'any.required': 'Config key is required',
  }),
  value: Joi.any().required().messages({
    'any.required': 'Config value is required',
  }),
  description: Joi.string().trim().optional(),
});

module.exports = {
  approveUserSchema,
  assignRfidSchema,
  blockUserSchema,
  changeRoleSchema,
  resetPasswordSchema,
  systemConfigSchema,
};
