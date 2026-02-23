// ============================================
// LUNEX — Issue Routes
// ============================================
const express = require('express');
const router = express.Router();
const {
  reportIssue,
  getMyIssues,
  getAllIssues,
  verifyIssue,
  resolveIssue,
  dismissIssue,
  triggerPriorityRebook,
  respondToPriorityRebook,
  getPendingPriorityRebooks,
} = require('../controllers/issueController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { validate } = require('../middleware/validate');
const { reportIssueSchema, resolveIssueSchema } = require('../validators/issueValidator');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(protect);

// User routes
router.post('/', authorize(ROLES.USER), validate(reportIssueSchema), reportIssue);
router.get('/my', authorize(ROLES.USER), getMyIssues);
router.get('/priority-rebook/pending', authorize(ROLES.USER), getPendingPriorityRebooks);
router.put('/priority-rebook/:id/respond', authorize(ROLES.USER), respondToPriorityRebook);

// Warden + Admin routes
router.get('/all', authorize(ROLES.WARDEN, ROLES.ADMIN), getAllIssues);
router.put('/:id/verify', authorize(ROLES.WARDEN, ROLES.ADMIN), verifyIssue);
router.put(
  '/:id/resolve',
  authorize(ROLES.WARDEN, ROLES.ADMIN),
  validate(resolveIssueSchema),
  resolveIssue
);
router.put('/:id/dismiss', authorize(ROLES.WARDEN, ROLES.ADMIN), dismissIssue);
router.post(
  '/:id/priority-rebook',
  authorize(ROLES.WARDEN, ROLES.ADMIN),
  triggerPriorityRebook
);

module.exports = router;
