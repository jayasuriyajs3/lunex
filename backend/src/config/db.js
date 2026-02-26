// ============================================
// LUNEX — Database Configuration
// ============================================
const mongoose = require('mongoose');
const User = require('../models/User');

const ensureRfidIndex = async () => {
  const collection = User.collection;

  await collection.updateMany({ rfidUID: null }, { $unset: { rfidUID: '' } });

  const indexes = await collection.indexes();
  const rfidIndex = indexes.find((index) => index.name === 'rfidUID_1');

  const hasExpectedPartialFilter =
    rfidIndex?.partialFilterExpression?.rfidUID?.$type === 'string';

  if (rfidIndex && !hasExpectedPartialFilter) {
    await collection.dropIndex('rfidUID_1');
  }

  if (!rfidIndex || !hasExpectedPartialFilter) {
    await collection.createIndex(
      { rfidUID: 1 },
      {
        name: 'rfidUID_1',
        unique: true,
        partialFilterExpression: {
          rfidUID: { $type: 'string' },
        },
      }
    );
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    await ensureRfidIndex();
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
