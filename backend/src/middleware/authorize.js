// ============================================
// LUNEX — Role Authorization Middleware
// ============================================
const AppError = require('../utils/AppError');

/**
 * Restrict access to specific roles
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(`Role '${req.user.role}' is not authorized to access this resource.`, 403)
      );
    }

    next();
  };
};

module.exports = authorize;
