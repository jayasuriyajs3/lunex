// ============================================
// LUNEX — Notification Service
// ============================================
const Notification = require('../models/Notification');

/**
 * Create and store a notification
 */
const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      data,
    });

    // TODO: Send push notification via FCM if user has fcmToken
    // For now, we just store it in the database

    return notification;
  } catch (error) {
    console.error('Notification creation failed:', error.message);
    return null;
  }
};

/**
 * Send notification to multiple users
 */
const createBulkNotifications = async (userIds, type, title, message, data = {}) => {
  try {
    const notifications = userIds.map((userId) => ({
      user: userId,
      type,
      title,
      message,
      data,
    }));

    const result = await Notification.insertMany(notifications);
    return result;
  } catch (error) {
    console.error('Bulk notification creation failed:', error.message);
    return null;
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
};
