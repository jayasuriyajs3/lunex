// ============================================
// LUNEX — Admin Routes
// ============================================
const express = require('express');
const router = express.Router();
const {
  // User management
  getAllUsers,
  getPendingUsers,
  approveUser,
  rejectUser,
  blockUser,
  unblockUser,
  assignRFID,
  revokeRFID,
  changeUserRole,
  resetUserPassword,
  // System config
  getSystemConfigs,
  setSystemConfig,
  deleteSystemConfig,
  // Emergency
  emergencyShutdown,
  emergencyReset,
  // Analytics
  getDashboardAnalytics,
  getMachineUtilization,
  getNoShowStats,
  getPeakUsage,
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  approveUserSchema,
  assignRfidSchema,
  blockUserSchema,
  changeRoleSchema,
  resetPasswordSchema,
  systemConfigSchema,
} = require('../validators/adminValidator');
const { ROLES } = require('../config/constants');

// All routes require Admin authentication
router.use(protect, authorize(ROLES.ADMIN));

// ---- User Management ----
router.get('/users', getAllUsers);
router.get('/users/pending', getPendingUsers);
router.put('/users/approve', validate(approveUserSchema), approveUser);
router.put('/users/reject', validate(approveUserSchema), rejectUser);
router.put('/users/block', validate(blockUserSchema), blockUser);
router.put('/users/unblock', validate(blockUserSchema), unblockUser);
router.put('/users/assign-rfid', validate(assignRfidSchema), assignRFID);
router.put('/users/revoke-rfid', validate(blockUserSchema), revokeRFID);
router.put('/users/change-role', validate(changeRoleSchema), changeUserRole);
router.put('/users/reset-password', validate(resetPasswordSchema), resetUserPassword);

// ---- System Configuration ----
router.get('/config', getSystemConfigs);
router.put('/config', validate(systemConfigSchema), setSystemConfig);
router.delete('/config/:key', deleteSystemConfig);

// ---- Emergency Controls ----
router.post('/emergency/shutdown', emergencyShutdown);
router.post('/emergency/reset', emergencyReset);

// ---- Analytics ----
router.get('/analytics/dashboard', getDashboardAnalytics);
router.get('/analytics/machine-utilization', getMachineUtilization);
router.get('/analytics/no-shows', getNoShowStats);
router.get('/analytics/peak-usage', getPeakUsage);

module.exports = router;
