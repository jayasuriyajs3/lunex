// ============================================
// LUNEX — Session Routes
// ============================================
const express = require('express');
const router = express.Router();
const {
  startSession,
  getActiveSession,
  extendSession,
  endSession,
  pauseSession,
  resumeSession,
  forceStopSession,
  getSessionHistory,
  getAllSessions,
} = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(protect);

// User routes
router.post('/start', authorize(ROLES.USER, ROLES.WARDEN, ROLES.ADMIN), startSession);
router.get('/active', authorize(ROLES.USER, ROLES.WARDEN, ROLES.ADMIN), getActiveSession);
router.post('/:id/extend', authorize(ROLES.USER, ROLES.WARDEN, ROLES.ADMIN), extendSession);
router.post('/:id/end', endSession);
router.get('/history', authorize(ROLES.USER, ROLES.WARDEN, ROLES.ADMIN), getSessionHistory);

// Warden + Admin routes
router.post('/:id/pause', authorize(ROLES.WARDEN, ROLES.ADMIN), pauseSession);
router.post('/:id/resume', authorize(ROLES.WARDEN, ROLES.ADMIN), resumeSession);
router.post('/:id/force-stop', authorize(ROLES.WARDEN, ROLES.ADMIN), forceStopSession);
router.get('/all', authorize(ROLES.WARDEN, ROLES.ADMIN), getAllSessions);

module.exports = router;
