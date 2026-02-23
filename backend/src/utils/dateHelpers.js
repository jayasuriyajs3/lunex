// ============================================
// LUNEX — Date/Time Helpers
// ============================================

/**
 * Get start of day for a date
 */
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get end of day for a date
 */
const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Add minutes to a date
 */
const addMinutes = (date, minutes) => {
  return new Date(new Date(date).getTime() + minutes * 60000);
};

/**
 * Subtract minutes from a date
 */
const subtractMinutes = (date, minutes) => {
  return new Date(new Date(date).getTime() - minutes * 60000);
};

/**
 * Get difference in minutes between two dates
 */
const diffInMinutes = (date1, date2) => {
  return Math.abs(new Date(date1) - new Date(date2)) / 60000;
};

/**
 * Check if two time ranges overlap
 */
const isOverlapping = (start1, end1, start2, end2) => {
  return new Date(start1) < new Date(end2) && new Date(start2) < new Date(end1);
};

/**
 * Check if a date is in the past
 */
const isPast = (date) => {
  return new Date(date) < new Date();
};

/**
 * Check if a date is today
 */
const isToday = (date) => {
  const today = new Date();
  const d = new Date(date);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

module.exports = {
  startOfDay,
  endOfDay,
  addMinutes,
  subtractMinutes,
  diffInMinutes,
  isOverlapping,
  isPast,
  isToday,
};
