// ============================================
// LUNEX — Issue Controller
// ============================================
const Issue = require('../models/Issue');
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const Machine = require('../models/Machine');
const PriorityRebook = require('../models/PriorityRebook');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/sendResponse');
const {
  ISSUE_STATUS,
  SESSION_STATUS,
  BOOKING_STATUS,
  MACHINE_STATUS,
  NOTIFICATION_TYPES,
  PRIORITY_REBOOK_STATUS,
} = require('../config/constants');
const { addMinutes } = require('../utils/dateHelpers');
const { createNotification } = require('../services/notificationService');
const { findNextAvailableSlot } = require('../services/bookingService');

/**
 * @desc    Report an issue (water/power/machine fault)
 * @route   POST /api/issues
 * @access  Private (User)
 */
const reportIssue = asyncHandler(async (req, res) => {
  const { machineId, bookingId, issueType, description } = req.body;

  // Find machine
  const machine = await Machine.findOne({ machineId });
  if (!machine) {
    throw new AppError('Machine not found.', 404);
  }

  // Find booking if provided
  let booking = null;
  let session = null;

  if (bookingId) {
    booking = await Booking.findById(bookingId);
    if (booking && booking.session) {
      session = await Session.findById(booking.session);
    }
  }

  // Create issue
  const issue = await Issue.create({
    reportedBy: req.user._id,
    machine: machine._id,
    booking: booking ? booking._id : null,
    session: session ? session._id : null,
    issueType,
    description,
  });

  // If there's an active session, pause it
  if (session && session.status === SESSION_STATUS.RUNNING) {
    session.status = SESSION_STATUS.PAUSED;
    session.pausedAt = new Date();
    session.interruptedBy = issue._id;
    await session.save();
    issue.sessionPaused = true;
    await issue.save();
  }

  // Notify wardens/admins about the issue
  await createNotification(
    req.user._id,
    NOTIFICATION_TYPES.ISSUE_REPORTED,
    'Issue Reported',
    `Your ${issueType} issue on ${machine.name} has been reported. A warden will investigate.`,
    { issueId: issue._id, machineId: machine.machineId }
  );

  const populatedIssue = await Issue.findById(issue._id)
    .populate('reportedBy', 'name email')
    .populate('machine', 'machineId name location');

  sendResponse(res, 201, true, 'Issue reported successfully.', { issue: populatedIssue });
});

/**
 * @desc    Get issues for current user
 * @route   GET /api/issues/my
 * @access  Private (User)
 */
const getMyIssues = asyncHandler(async (req, res) => {
  const issues = await Issue.find({ reportedBy: req.user._id })
    .populate('machine', 'machineId name location')
    .sort({ createdAt: -1 });

  sendResponse(res, 200, true, 'Issues retrieved.', { issues });
});

/**
 * @desc    Get all issues (Warden/Admin)
 * @route   GET /api/issues/all
 * @access  Private (Warden, Admin)
 */
const getAllIssues = asyncHandler(async (req, res) => {
  const { status, machineId, page = 1, limit = 50 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (machineId) {
    const machine = await Machine.findOne({ machineId });
    if (machine) query.machine = machine._id;
  }

  const total = await Issue.countDocuments(query);
  const issues = await Issue.find(query)
    .populate('reportedBy', 'name email phone roomNumber')
    .populate('machine', 'machineId name location')
    .populate('verifiedBy', 'name')
    .populate('resolvedBy', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  sendResponse(res, 200, true, 'All issues retrieved.', {
    issues,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * @desc    Verify an issue (Warden)
 * @route   PUT /api/issues/:id/verify
 * @access  Private (Warden, Admin)
 */
const verifyIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    throw new AppError('Issue not found.', 404);
  }

  if (issue.status !== ISSUE_STATUS.REPORTED) {
    throw new AppError(`Cannot verify issue with status: ${issue.status}.`, 400);
  }

  issue.status = ISSUE_STATUS.VERIFIED;
  issue.verifiedBy = req.user._id;
  issue.verifiedAt = new Date();
  await issue.save();

  sendResponse(res, 200, true, 'Issue verified.', { issue });
});

/**
 * @desc    Resolve an issue (Warden/Admin)
 * @route   PUT /api/issues/:id/resolve
 * @access  Private (Warden, Admin)
 */
const resolveIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate('machine');

  if (!issue) {
    throw new AppError('Issue not found.', 404);
  }

  if (issue.status === ISSUE_STATUS.RESOLVED) {
    throw new AppError('Issue already resolved.', 400);
  }

  issue.status = ISSUE_STATUS.RESOLVED;
  issue.resolvedBy = req.user._id;
  issue.resolvedAt = new Date();
  issue.resolutionNote = req.body.resolutionNote || '';
  await issue.save();

  // If session was paused, try to resume
  if (issue.sessionPaused && issue.session) {
    const session = await Session.findById(issue.session);
    if (session && session.status === SESSION_STATUS.PAUSED) {
      // Resume the session
      const now = new Date();
      const pausedMinutes = Math.round((now - session.pausedAt) / 60000);

      session.status = SESSION_STATUS.RUNNING;
      session.resumedAt = now;
      session.totalPausedMinutes += pausedMinutes;
      const currentEnd = session.extendedEndAt || session.scheduledEndAt;
      session.extendedEndAt = addMinutes(currentEnd, pausedMinutes);
      await session.save();

      await Booking.findByIdAndUpdate(session.booking, { endTime: session.extendedEndAt });
    }
  }

  // Notify the reporter
  await createNotification(
    issue.reportedBy,
    NOTIFICATION_TYPES.ISSUE_RESOLVED,
    'Issue Resolved',
    `Your reported issue has been resolved. ${issue.resolutionNote || ''}`,
    { issueId: issue._id }
  );

  sendResponse(res, 200, true, 'Issue resolved.', { issue });
});

/**
 * @desc    Dismiss an issue
 * @route   PUT /api/issues/:id/dismiss
 * @access  Private (Warden, Admin)
 */
const dismissIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    throw new AppError('Issue not found.', 404);
  }

  issue.status = ISSUE_STATUS.DISMISSED;
  issue.resolvedBy = req.user._id;
  issue.resolvedAt = new Date();
  issue.resolutionNote = req.body.resolutionNote || 'Issue dismissed';
  await issue.save();

  // If session was paused, resume it
  if (issue.sessionPaused && issue.session) {
    const session = await Session.findById(issue.session);
    if (session && session.status === SESSION_STATUS.PAUSED) {
      const now = new Date();
      const pausedMinutes = Math.round((now - session.pausedAt) / 60000);

      session.status = SESSION_STATUS.RUNNING;
      session.resumedAt = now;
      session.totalPausedMinutes += pausedMinutes;
      const currentEnd = session.extendedEndAt || session.scheduledEndAt;
      session.extendedEndAt = addMinutes(currentEnd, pausedMinutes);
      await session.save();
    }
  }

  sendResponse(res, 200, true, 'Issue dismissed.', { issue });
});

/**
 * @desc    Trigger priority rebooking for interrupted session
 * @route   POST /api/issues/:id/priority-rebook
 * @access  Private (Warden, Admin)
 */
const triggerPriorityRebook = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate('machine');

  if (!issue) {
    throw new AppError('Issue not found.', 404);
  }

  if (issue.priorityRebookOffered) {
    throw new AppError('Priority rebook already offered for this issue.', 400);
  }

  // Find next available slot on any available machine
  const machines = await Machine.find({
    status: { $in: [MACHINE_STATUS.AVAILABLE] },
  });

  if (machines.length === 0) {
    throw new AppError('No machines available for rebooking.', 400);
  }

  // Try to find a slot on each machine
  let bestSlot = null;
  let bestMachine = null;

  for (const m of machines) {
    const slot = await findNextAvailableSlot(m._id, 30); // 30 mins default
    if (!bestSlot || slot.startTime < bestSlot.startTime) {
      bestSlot = slot;
      bestMachine = m;
    }
  }

  if (!bestSlot) {
    throw new AppError('No available slots found.', 400);
  }

  let originalBookingId = issue.booking;

  if (!originalBookingId && issue.session) {
    const session = await Session.findById(issue.session).select('booking');
    if (session?.booking) {
      originalBookingId = session.booking;
    }
  }

  if (!originalBookingId) {
    const fallbackBooking = await Booking.findOne({
      user: issue.reportedBy,
      machine: issue.machine._id,
      status: {
        $in: [
          BOOKING_STATUS.ACTIVE,
          BOOKING_STATUS.CONFIRMED,
          BOOKING_STATUS.COMPLETED,
          BOOKING_STATUS.INTERRUPTED,
        ],
      },
    }).sort({ startTime: -1, createdAt: -1 });

    if (fallbackBooking) {
      originalBookingId = fallbackBooking._id;
    }
  }

  if (!originalBookingId) {
    throw new AppError('Cannot offer priority rebook because no related booking was found.', 400);
  }

  // Create priority rebook offer
  const priorityRebook = await PriorityRebook.create({
    user: issue.reportedBy,
    originalBooking: originalBookingId,
    issue: issue._id,
    offeredSlot: {
      machine: bestMachine._id,
      startTime: bestSlot.startTime,
      endTime: bestSlot.endTime,
    },
    status: PRIORITY_REBOOK_STATUS.OFFERED,
    expiresAt: addMinutes(new Date(), 30), // 30 min to respond
  });

  issue.priorityRebookOffered = true;
  await issue.save();

  // Mark user for priority
  await User.findByIdAndUpdate(issue.reportedBy, { hasPriorityRebook: true });

  // Notify user
  await createNotification(
    issue.reportedBy,
    NOTIFICATION_TYPES.PRIORITY_REBOOK,
    'Priority Rebooking Available',
    `A free slot is available on ${bestMachine.name} at ${bestSlot.startTime.toLocaleTimeString()}. Would you like to rebook?`,
    {
      priorityRebookId: priorityRebook._id,
      machineId: bestMachine.machineId,
      startTime: bestSlot.startTime,
      endTime: bestSlot.endTime,
    }
  );

  sendResponse(res, 200, true, 'Priority rebook offered to user.', {
    priorityRebook,
    offeredMachine: {
      machineId: bestMachine.machineId,
      name: bestMachine.name,
      location: bestMachine.location,
    },
    offeredSlot: bestSlot,
  });
});

/**
 * @desc    Respond to priority rebook offer (User)
 * @route   PUT /api/issues/priority-rebook/:id/respond
 * @access  Private (User)
 */
const respondToPriorityRebook = asyncHandler(async (req, res) => {
  const { action } = req.body; // 'accept' or 'decline'

  const priorityRebook = await PriorityRebook.findById(req.params.id).populate(
    'offeredSlot.machine'
  );

  if (!priorityRebook) {
    throw new AppError('Priority rebook offer not found.', 404);
  }

  if (priorityRebook.user.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized.', 403);
  }

  if (priorityRebook.status !== PRIORITY_REBOOK_STATUS.OFFERED) {
    throw new AppError('This offer is no longer available.', 400);
  }

  // Check if expired
  if (new Date() > priorityRebook.expiresAt) {
    priorityRebook.status = PRIORITY_REBOOK_STATUS.EXPIRED;
    await priorityRebook.save();
    throw new AppError('This offer has expired.', 400);
  }

  if (action === 'accept') {
    // Create a new priority booking
    const newBooking = await Booking.create({
      user: req.user._id,
      machine: priorityRebook.offeredSlot.machine._id,
      slotDate: new Date(priorityRebook.offeredSlot.startTime).setHours(0, 0, 0, 0),
      startTime: priorityRebook.offeredSlot.startTime,
      endTime: priorityRebook.offeredSlot.endTime,
      durationMinutes: Math.round(
        (priorityRebook.offeredSlot.endTime - priorityRebook.offeredSlot.startTime) / 60000
      ),
      status: BOOKING_STATUS.CONFIRMED,
      isPriorityBooking: true,
    });

    priorityRebook.status = PRIORITY_REBOOK_STATUS.ACCEPTED;
    priorityRebook.newBooking = newBooking._id;
    priorityRebook.respondedAt = new Date();
    await priorityRebook.save();

    await User.findByIdAndUpdate(req.user._id, { hasPriorityRebook: false });

    sendResponse(res, 200, true, 'Priority rebook accepted. New booking created.', {
      booking: newBooking,
    });
  } else {
    priorityRebook.status = PRIORITY_REBOOK_STATUS.DECLINED;
    priorityRebook.respondedAt = new Date();
    await priorityRebook.save();

    await User.findByIdAndUpdate(req.user._id, { hasPriorityRebook: false });

    sendResponse(res, 200, true, 'Priority rebook declined. You can book manually.', {});
  }
});

/**
 * @desc    Get pending priority rebook offers for current user
 * @route   GET /api/issues/priority-rebook/pending
 * @access  Private (User)
 */
const getPendingPriorityRebooks = asyncHandler(async (req, res) => {
  const rebooks = await PriorityRebook.find({
    user: req.user._id,
    status: PRIORITY_REBOOK_STATUS.OFFERED,
    expiresAt: { $gte: new Date() },
  })
    .populate('offeredSlot.machine', 'machineId name location')
    .populate('originalBooking', 'startTime endTime')
    .populate('issue', 'issueType description');

  sendResponse(res, 200, true, 'Pending priority rebooks retrieved.', { rebooks });
});

module.exports = {
  reportIssue,
  getMyIssues,
  getAllIssues,
  verifyIssue,
  resolveIssue,
  dismissIssue,
  triggerPriorityRebook,
  respondToPriorityRebook,
  getPendingPriorityRebooks,
};
