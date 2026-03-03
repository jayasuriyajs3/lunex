// ============================================
// LUNEX — System Config Service (runtime reads)
// ============================================
const SystemConfig = require('../models/SystemConfig');

const parseInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.trunc(numeric);
};

const readEnvInteger = (envKey) => {
  if (!envKey) return null;
  return parseInteger(process.env[envKey]);
};

const getNumericSystemConfig = async ({
  key,
  envKey,
  fallback,
  min = null,
  max = null,
}) => {
  let result = null;

  if (key) {
    const doc = await SystemConfig.findOne({ key }).select('value').lean();
    if (doc && doc.value !== undefined && doc.value !== null) {
      result = parseInteger(doc.value);
    }
  }

  if (result === null) {
    result = readEnvInteger(envKey);
  }

  if (result === null) {
    result = parseInteger(fallback);
  }

  if (result === null) {
    return 0;
  }

  if (min !== null && result < min) result = min;
  if (max !== null && result > max) result = max;

  return result;
};

module.exports = {
  getNumericSystemConfig,
};
