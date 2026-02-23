// ============================================
// LUNEX — Machine Routes
// ============================================
const express = require('express');
const router = express.Router();
const {
  createMachine,
  getAllMachines,
  getMachineById,
  updateMachine,
  updateMachineStatus,
  deleteMachine,
  heartbeat,
} = require('../controllers/machineController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const {
  createMachineSchema,
  updateMachineStatusSchema,
  updateMachineSchema,
} = require('../validators/machineValidator');
const { ROLES } = require('../config/constants');

// ESP32 heartbeat (no auth — from hardware)
router.post('/:machineId/heartbeat', heartbeat);

// Protected routes
router.use(protect);

router.get('/', getAllMachines);
router.get('/:machineId', getMachineById);

// Admin only
router.post('/', authorize(ROLES.ADMIN), validate(createMachineSchema), createMachine);
router.put('/:machineId', authorize(ROLES.ADMIN), validate(updateMachineSchema), updateMachine);
router.delete('/:machineId', authorize(ROLES.ADMIN), deleteMachine);

// Warden + Admin
router.put(
  '/:machineId/status',
  authorize(ROLES.WARDEN, ROLES.ADMIN),
  validate(updateMachineStatusSchema),
  updateMachineStatus
);

module.exports = router;
