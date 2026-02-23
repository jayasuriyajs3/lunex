// ============================================
// LUNEX — Joi Validation Middleware
// ============================================
const AppError = require('../utils/AppError');

/**
 * Validate request body against a Joi schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message.replace(/"/g, '')).join('. ');
      return next(new AppError(message, 400));
    }

    req.body = value;
    next();
  };
};

/**
 * Validate request query against a Joi schema
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message.replace(/"/g, '')).join('. ');
      return next(new AppError(message, 400));
    }

    req.query = value;
    next();
  };
};

/**
 * Validate request params against a Joi schema
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message.replace(/"/g, '')).join('. ');
      return next(new AppError(message, 400));
    }

    req.params = value;
    next();
  };
};

module.exports = { validate, validateQuery, validateParams };
