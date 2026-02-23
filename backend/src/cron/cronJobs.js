// ============================================
// LUNEX — Cron Jobs (No-Show, Auto-End, Reminders)
// ============================================
const cron = require('node-cron');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const Machine = require('../models/Machine');
const User = require('../models/User');
const PriorityRebook = require('../models/PriorityRebook');
const {
  BOOKING_STATUS,
  SESSION_STATUS,
  MACHINE_STATUS,
  NOTIFICATION_TYPES,
  PRIORITY_REBOOK_STATUS,
} = require('../config/constants');
const { addMinutes, diffInMinutes } = require('../utils/dateHelpers');
const { createNotification } = require('../services/notificationService');

/**
 * Job 1: No-Show Detection & Auto-Cancellation
 * Runs every minute
 *
 * - If user hasn't arrived within GRACE_PERIOD_MINUTES after booking start → no-show
 * - Sends reminder at REMINDER_BEFORE_MINUTES before auto-cancel
 */
const noShowJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const graceMinutes = parseInt(process.env.GRACE_PERIOD_MINUTES) || 10;
      const reminderMinutes = parseInt(process.env.REMINDER_BEFORE_MINUTES) || 5;

      // Find confirmed bookings where start time has passed
      const overdueBookings = await Booking.find({
        status: BOOKING_STATUS.CONFIRMED,
        startTime: { $lte: now },
      }).populate('user machine');

      for (const booking of overdueBookings) {
        const minutesPast = diffInMinutes(booking.startTime, now);

        // Send 5-minute reminder (if 5 min past and no reminder sent yet)
        if (minutesPast >= reminderMinutes && !booking.reminderSentAt) {
          booking.reminderSentAt = new Date();
          await booking.save();

          await createNotification(
            booking.user._id,
            NOTIFICATION_TYPES.NO_SHOW_WARNING,
            'Arrive Now!',
            `You have ${graceMinutes - reminderMinutes} minutes to arrive at ${booking.machine.name} or your booking will be cancelled.`,
            { bookingId: booking._id }
          );
        }

        // Auto-cancel at grace period (10 min)
        if (minutesPast >= graceMinutes) {
          booking.status = BOOKING_STATUS.NO_SHOW;
          booking.noShowAt = new Date();
          await booking.save();

          // Increment no-show count
          await User.findByIdAndUpdate(booking.user._id, {
            $inc: { noShowCount: 1 },
          });

          // Free the machine if it was reserved
          if (booking.machine.currentBooking?.toString() === booking._id.toString()) {
            await Machine.findByIdAndUpdate(booking.machine._id, {
              status: MACHINE_STATUS.AVAILABLE,
              currentBooking: null,
            });
          }

          await createNotification(
            booking.user._id,
            NOTIFICATION_TYPES.SLOT_RELEASED,
            'Booking Cancelled',
            `Your booking on ${booking.machine.name} was cancelled due to no-show.`,
            { bookingId: booking._id }
          );

          console.log(
            `⏰ No-show: Booking ${booking._id} cancelled for user ${booking.user.name}`
          );
        }
      }
    } catch (error) {
      console.error('No-show job error:', error.message);
    }
  });
};

/**
 * Job 2: Auto-End Sessions
 * Runs every minute
 *
 * - Ends sessions that have passed their scheduled/extended end time
 * - Powers off the machine
 */
const autoEndSessionJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Find running sessions past their end time
      const expiredSessions = await Session.find({
        status: SESSION_STATUS.RUNNING,
        $or: [
          { extendedEndAt: { $lte: now, $ne: null } },
          { extendedEndAt: null, scheduledEndAt: { $lte: now } },
        ],
      });

      for (const session of expiredSessions) {
        session.status = SESSION_STATUS.COMPLETED;
        session.actualEndAt = now;
        session.powerOffAt = now;
        session.terminatedBy = 'auto';
        session.durationMinutes = Math.round(diffInMinutes(session.startedAt, now));
        await session.save();

        // Update booking
        await Booking.findByIdAndUpdate(session.booking, {
          status: BOOKING_STATUS.COMPLETED,
        });

        // Free machine
        const machine = await Machine.findById(session.machine);
        if (machine) {
          machine.status = MACHINE_STATUS.AVAILABLE;
          machine.currentBooking = null;
          machine.currentSession = null;
          machine.totalUsageCount += 1;
          machine.totalUsageMinutes += session.durationMinutes;
          await machine.save();
        }

        await createNotification(
          session.user,
          NOTIFICATION_TYPES.SESSION_COMPLETED,
          'Session Completed',
          `Your washing session has ended automatically. Duration: ${session.durationMinutes} minutes.`,
          { sessionId: session._id }
        );

        console.log(`✅ Auto-end: Session ${session._id} completed`);
      }
    } catch (error) {
      console.error('Auto-end session job error:', error.message);
    }
  });
};

/**
 * Job 3: Session Ending Reminders
 * Runs every minute
 *
 * - Warns users 5 minutes before their session ends
 */
const sessionEndingReminderJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const fiveMinLater = addMinutes(now, 5);

      // Find running sessions ending in the next 5 minutes
      const endingSessions = await Session.find({
        status: SESSION_STATUS.RUNNING,
        $or: [
          {
            extendedEndAt: { $lte: fiveMinLater, $gte: now, $ne: null },
          },
          {
            extendedEndAt: null,
            scheduledEndAt: { $lte: fiveMinLater, $gte: now },
          },
        ],
      }).populate('machine', 'name');

      for (const session of endingSessions) {
        const endTime = session.extendedEndAt || session.scheduledEndAt;
        const remaining = Math.ceil(diffInMinutes(now, endTime));

        // Only send if ~5 min left (avoid sending every minute)
        if (remaining <= 5 && remaining >= 4) {
          await createNotification(
            session.user,
            NOTIFICATION_TYPES.SESSION_ENDING,
            'Session Ending Soon',
            `Your session on ${session.machine.name} will end in ~${remaining} minutes.${session.extensionGranted ? '' : ' You can extend by 5 minutes.'}`,
            { sessionId: session._id, canExtend: !session.extensionGranted }
          );
        }
      }
    } catch (error) {
      console.error('Session ending reminder job error:', error.message);
    }
  });
};

/**
 * Job 4: Expire Priority Rebook Offers
 * Runs every 5 minutes
 */
const expirePriorityRebooksJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      const expired = await PriorityRebook.updateMany(
        {
          status: PRIORITY_REBOOK_STATUS.OFFERED,
          expiresAt: { $lte: now },
        },
        { status: PRIORITY_REBOOK_STATUS.EXPIRED }
      );

      if (expired.modifiedCount > 0) {
        console.log(`🔄 Expired ${expired.modifiedCount} priority rebook offers`);
      }
    } catch (error) {
      console.error('Expire priority rebooks job error:', error.message);
    }
  });
};

/**
 * Job 5: Machine Heartbeat Check
 * Runs every 5 minutes — marks machines offline if no heartbeat in 10 min
 */
const machineHeartbeatJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const tenMinAgo = new Date(Date.now() - 10 * 60000);

      await Machine.updateMany(
        {
          isOnline: true,
          lastHeartbeat: { $lte: tenMinAgo },
        },
        { isOnline: false }
      );
    } catch (error) {
      console.error('Heartbeat check job error:', error.message);
    }
  });
};

/**
 * Initialize all cron jobs
 */
const initCronJobs = () => {
  console.log('⏰ Starting cron jobs...');
  noShowJob();
  autoEndSessionJob();
  sessionEndingReminderJob();
  expirePriorityRebooksJob();
  machineHeartbeatJob();
  console.log('✅ Cron jobs initialized');
};

module.exports = initCronJobs;
