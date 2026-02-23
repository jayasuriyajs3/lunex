// ============================================
// LUNEX — RFID Routes
// ============================================
const express = require('express');
const router = express.Router();
const { scanRFID, validateRFID } = require('../controllers/rfidController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');

// ESP32 RFID scan endpoint (no JWT auth — hardware endpoint)
router.post('/scan', scanRFID);

// Admin only — validate an RFID before assigning
router.post('/validate', protect, authorize(ROLES.ADMIN), validateRFID);

module.exports = router;
