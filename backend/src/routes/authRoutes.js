// ============================================
// LUNEX — Auth Routes
// ============================================
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refreshAccessToken,
  getMe,
  checkStatus,
  updateProfile,
  changePassword,
  logout,
} = require('../controllers/authController');
const { protect, protectAllowPending } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  refreshTokenSchema,
} = require('../validators/authValidator');

// Public routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh-token', validate(refreshTokenSchema), refreshAccessToken);

// Protected routes (allow pending users)
router.get('/status', protectAllowPending, checkStatus);

// Protected routes (active users only)
router.get('/me', protect, getMe);
router.put('/profile', protect, validate(updateProfileSchema), updateProfile);
router.put('/change-password', protect, validate(changePasswordSchema), changePassword);
router.post('/logout', protect, logout);

module.exports = router;
