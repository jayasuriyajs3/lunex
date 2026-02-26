const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const { ROLES, ACCOUNT_STATUS } = require('../config/constants');

const getArgValue = (name) => {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) return undefined;
  return process.argv[index + 1];
};

const normalizeEmail = (value) => (value || '').trim().toLowerCase();

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in environment variables.');
  }

  const email = normalizeEmail(getArgValue('email') || process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@lunex.com');
  const password = getArgValue('password') || process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = (getArgValue('name') || process.env.BOOTSTRAP_ADMIN_NAME || 'LUNEX Admin').trim();
  const phone = (getArgValue('phone') || process.env.BOOTSTRAP_ADMIN_PHONE || '9999999999').trim();

  if (!email) {
    throw new Error('Admin email is required. Pass --email or BOOTSTRAP_ADMIN_EMAIL.');
  }

  await mongoose.connect(mongoUri);

  let user = await User.findOne({ email });

  if (!user) {
    if (!password) {
      throw new Error('Password is required for first-time admin creation. Pass --password or BOOTSTRAP_ADMIN_PASSWORD.');
    }

    user = await User.create({
      name,
      email,
      phone,
      password,
      role: ROLES.ADMIN,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      approvedAt: new Date(),
    });

    console.log(`✅ Admin created: ${user.email}`);
  } else {
    user.role = ROLES.ADMIN;
    user.accountStatus = ACCOUNT_STATUS.ACTIVE;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (password) user.password = password;
    if (!user.approvedAt) user.approvedAt = new Date();

    await user.save();
    console.log(`✅ Admin updated/reactivated: ${user.email}`);
  }

  console.log('Done. You can now log in with this admin account.');
};

run()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`❌ ${error.message}`);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  });
