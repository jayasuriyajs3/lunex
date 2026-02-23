// ============================================
// LUNEX — Constants
// ============================================

module.exports = {
  // Roles
  ROLES: {
    USER: 'user',
    WARDEN: 'warden',
    ADMIN: 'admin',
  },

  // Account Status
  ACCOUNT_STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    BLOCKED: 'blocked',
    REJECTED: 'rejected',
  },

  // Machine Status
  MACHINE_STATUS: {
    AVAILABLE: 'available',
    IN_USE: 'in-use',
    MAINTENANCE: 'maintenance',
    REPAIR: 'repair',
    DISABLED: 'disabled',
  },

  // Booking Status
  BOOKING_STATUS: {
    CONFIRMED: 'confirmed',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no-show',
    INTERRUPTED: 'interrupted',
  },

  // Session Status
  SESSION_STATUS: {
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    TERMINATED: 'terminated',
    INTERRUPTED: 'interrupted',
  },

  // Issue Types
  ISSUE_TYPES: {
    WATER: 'water',
    POWER: 'power',
    MACHINE_FAULT: 'machine-fault',
    OTHER: 'other',
  },

  // Issue Status
  ISSUE_STATUS: {
    REPORTED: 'reported',
    VERIFIED: 'verified',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed',
  },

  // Notification Types
  NOTIFICATION_TYPES: {
    BOOKING_CONFIRMED: 'booking-confirmed',
    ARRIVAL_REMINDER: 'arrival-reminder',
    NO_SHOW_WARNING: 'no-show-warning',
    SLOT_RELEASED: 'slot-released',
    SESSION_STARTED: 'session-started',
    SESSION_ENDING: 'session-ending',
    SESSION_COMPLETED: 'session-completed',
    EXTENSION_GRANTED: 'extension-granted',
    MAINTENANCE_ALERT: 'maintenance-alert',
    ISSUE_REPORTED: 'issue-reported',
    ISSUE_RESOLVED: 'issue-resolved',
    PRIORITY_REBOOK: 'priority-rebook',
    ACCOUNT_APPROVED: 'account-approved',
    ACCOUNT_BLOCKED: 'account-blocked',
    RFID_ASSIGNED: 'rfid-assigned',
    EMERGENCY: 'emergency',
  },

  // Priority Rebook Status
  PRIORITY_REBOOK_STATUS: {
    OFFERED: 'offered',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
    COMPLETED: 'completed',
  },
};
