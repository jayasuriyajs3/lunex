// ============================================
// LUNEX — Issue Validation Schemas
// ============================================
const Joi = require('joi');
const { ISSUE_TYPES } = require('../config/constants');

const reportIssueSchema = Joi.object({
  machineId: Joi.string().required().messages({
    'any.required': 'Machine ID is required',
  }),
  bookingId: Joi.string().optional(),
  issueType: Joi.string()
    .valid(...Object.values(ISSUE_TYPES))
    .required()
    .messages({
      'any.only': `Issue type must be one of: ${Object.values(ISSUE_TYPES).join(', ')}`,
      'any.required': 'Issue type is required',
    }),
  description: Joi.string().trim().max(500).required().messages({
    'string.max': 'Description must not exceed 500 characters',
    'any.required': 'Description is required',
  }),
});

const resolveIssueSchema = Joi.object({
  resolutionNote: Joi.string().trim().max(500).optional(),
});

module.exports = {
  reportIssueSchema,
  resolveIssueSchema,
};
