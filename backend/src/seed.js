// ============================================
// LUNEX — Database Seeder
// Seeds a default admin user and sample machines
// ============================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Machine = require('./models/Machine');
const SystemConfig = require('./models/SystemConfig');
const { ROLES, ACCOUNT_STATUS, MACHINE_STATUS } = require('./config/constants');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // ---- Seed Admin User ----
    const existingAdmin = await User.findOne({ email: 'admin@lunex.com' });
    if (!existingAdmin) {
      await User.create({
        name: 'LUNEX Admin',
        email: 'admin@lunex.com',
        phone: '9999999999',
        password: 'admin123',
        role: ROLES.ADMIN,
        accountStatus: ACCOUNT_STATUS.ACTIVE,
        rfidUID: 'ADMIN001',
      });
      console.log('✅ Admin user created: admin@lunex.com / admin123');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // ---- Seed Warden User ----
    const existingWarden = await User.findOne({ email: 'warden@lunex.com' });
    if (!existingWarden) {
      await User.create({
        name: 'LUNEX Warden',
        email: 'warden@lunex.com',
        phone: '8888888888',
        password: 'warden123',
        role: ROLES.WARDEN,
        accountStatus: ACCOUNT_STATUS.ACTIVE,
        rfidUID: 'WARDEN01',
      });
      console.log('✅ Warden user created: warden@lunex.com / warden123');
    } else {
      console.log('ℹ️  Warden user already exists');
    }

    // ---- Seed Test User (already approved with RFID) ----
    const existingTestUser = await User.findOne({ email: 'user@lunex.com' });
    if (!existingTestUser) {
      await User.create({
        name: 'Test User',
        email: 'user@lunex.com',
        phone: '7777777777',
        password: 'user1234',
        role: ROLES.USER,
        accountStatus: ACCOUNT_STATUS.ACTIVE,
        rfidUID: 'USER0001',
        roomNumber: '101',
        hostelBlock: 'A',
      });
      console.log('✅ Test user created: user@lunex.com / user1234');
    } else {
      console.log('ℹ️  Test user already exists');
    }

    // ---- Seed Machines ----
    const machines = [
      {
        machineId: 'WM-001',
        name: 'Washer 1',
        location: 'Block A - Ground Floor',
        esp32Ip: '192.168.1.101',
        relayPin: 26,
        status: MACHINE_STATUS.AVAILABLE,
      },
      {
        machineId: 'WM-002',
        name: 'Washer 2',
        location: 'Block A - Ground Floor',
        esp32Ip: '192.168.1.102',
        relayPin: 26,
        status: MACHINE_STATUS.AVAILABLE,
      },
      {
        machineId: 'WM-003',
        name: 'Washer 3',
        location: 'Block B - First Floor',
        esp32Ip: '192.168.1.103',
        relayPin: 26,
        status: MACHINE_STATUS.AVAILABLE,
      },
    ];

    for (const machineData of machines) {
      const existing = await Machine.findOne({ machineId: machineData.machineId });
      if (!existing) {
        await Machine.create(machineData);
        console.log(`✅ Machine created: ${machineData.machineId} - ${machineData.name}`);
      } else {
        console.log(`ℹ️  Machine ${machineData.machineId} already exists`);
      }
    }

    // ---- Seed Default System Configs ----
    const configs = [
      {
        key: 'max_slot_duration_minutes',
        value: 60,
        description: 'Maximum duration for a single booking slot',
      },
      {
        key: 'buffer_between_slots_minutes',
        value: 10,
        description: 'Mandatory buffer between slots (5 min extension + 5 min rest)',
      },
      {
        key: 'extension_minutes',
        value: 5,
        description: 'Extension duration allowed per session',
      },
      {
        key: 'grace_period_minutes',
        value: 10,
        description: 'Time allowed for user to arrive after slot starts',
      },
      {
        key: 'reminder_before_minutes',
        value: 5,
        description: 'Reminder sent X minutes after slot starts if not arrived',
      },
      {
        key: 'max_bookings_per_day',
        value: 3,
        description: 'Maximum bookings allowed per user per day',
      },
      {
        key: 'max_advance_booking_days',
        value: 7,
        description: 'Maximum days in advance a user can book',
      },
    ];

    for (const cfg of configs) {
      await SystemConfig.findOneAndUpdate({ key: cfg.key }, cfg, {
        upsert: true,
        returnDocument: 'after',
      });
    }
    console.log('✅ System configs seeded');

    console.log('\n🎉 Database seeding completed!\n');
    console.log('=== TEST CREDENTIALS ===');
    console.log('Admin:  admin@lunex.com  / admin123');
    console.log('Warden: warden@lunex.com / warden123');
    console.log('User:   user@lunex.com   / user1234');
    console.log('========================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    process.exit(1);
  }
};

seedDB();
