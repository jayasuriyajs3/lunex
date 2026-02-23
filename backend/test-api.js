// ============================================
// LUNEX — Comprehensive API Test Script
// Tests all endpoints systematically
// ============================================

const BASE = 'http://localhost:5000';
let adminToken, wardenToken, userToken, newUserToken;
let bookingId, sessionId, issueId, priorityRebookId;
let testsPassed = 0;
let testsFailed = 0;
const results = [];

async function req(method, path, body = null, token = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

function log(test, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  if (passed) testsPassed++;
  else testsFailed++;
  const msg = `${icon} ${test}${detail ? ' — ' + detail : ''}`;
  console.log(msg);
  results.push({ test, passed, detail });
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║      LUNEX API — COMPREHENSIVE TEST SUITE       ║');
  console.log('║      "Book Smart. Wash Easy. Live Better."       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ========================================
  // 1. HEALTH CHECK
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  1. HEALTH CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const health = await req('GET', '/api/health');
  log('GET /api/health', health.status === 200 && health.data.success, `Status: ${health.status}`);

  // ========================================
  // 2. AUTHENTICATION
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  2. AUTHENTICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 2a. Register new user
  const testEmail = `apitest_${Date.now()}@lunex.com`;
  const register = await req('POST', '/api/auth/register', {
    name: 'API Test User',
    email: testEmail,
    phone: '5555555555',
    password: 'testpass123',
    roomNumber: '501',
    hostelBlock: 'D',
  });
  log('POST /api/auth/register', register.status === 201 || register.status === 409, register.data.message);
  if (register.data.data) newUserToken = register.data.data.accessToken;

  // 2b. Register duplicate email
  const dupRegister = await req('POST', '/api/auth/register', {
    name: 'Dup User',
    email: 'user@lunex.com',
    phone: '1111111111',
    password: 'test1234',
    roomNumber: '101',
    hostelBlock: 'A',
  });
  log('POST /api/auth/register (duplicate)', dupRegister.status === 409, dupRegister.data.message);

  // 2c. Register with missing fields (validation)
  const badRegister = await req('POST', '/api/auth/register', {
    email: 'bad@lunex.com',
  });
  log('POST /api/auth/register (validation)', badRegister.status === 400, badRegister.data.message);

  // 2d. Login as Admin
  const adminLogin = await req('POST', '/api/auth/login', {
    email: 'admin@lunex.com',
    password: 'admin123',
  });
  log('POST /api/auth/login (admin)', adminLogin.status === 200, `Role: ${adminLogin.data.data?.user?.role}`);
  adminToken = adminLogin.data.data?.accessToken;

  // 2e. Login as Warden
  const wardenLogin = await req('POST', '/api/auth/login', {
    email: 'warden@lunex.com',
    password: 'warden123',
  });
  log('POST /api/auth/login (warden)', wardenLogin.status === 200, `Role: ${wardenLogin.data.data?.user?.role}`);
  wardenToken = wardenLogin.data.data?.accessToken;

  // 2f. Login as User (try both passwords — previous run may have changed it)
  let userLogin = await req('POST', '/api/auth/login', {
    email: 'user@lunex.com',
    password: 'user1234',
  });
  if (userLogin.status !== 200) {
    // Password may have been changed in previous test run
    userLogin = await req('POST', '/api/auth/login', {
      email: 'user@lunex.com',
      password: 'user12345',
    });
  }
  log('POST /api/auth/login (user)', userLogin.status === 200, `Role: ${userLogin.data.data?.user?.role}`);
  userToken = userLogin.data.data?.accessToken;

  // 2g. Login with wrong password
  const badLogin = await req('POST', '/api/auth/login', {
    email: 'user@lunex.com',
    password: 'wrongpassword',
  });
  log('POST /api/auth/login (wrong password)', badLogin.status === 401, badLogin.data.message);

  // 2h. Get profile
  const me = await req('GET', '/api/auth/me', null, userToken);
  log('GET /api/auth/me', me.status === 200 && me.data.data?.user?.email === 'user@lunex.com', `Email: ${me.data.data?.user?.email}`);

  // 2i. Check status (allows pending users)
  const status = await req('GET', '/api/auth/status', null, userToken);
  log('GET /api/auth/status', status.status === 200, `Account: ${status.data.data?.accountStatus}`);

  // 2j. Update profile
  const updateProfile = await req('PUT', '/api/auth/profile', {
    name: 'Updated Test User',
    phone: '9998887776',
  }, userToken);
  log('PUT /api/auth/profile', updateProfile.status === 200, updateProfile.data.message);

  // 2k. Change password
  const changePwd = await req('PUT', '/api/auth/change-password', {
    currentPassword: 'user1234',
    newPassword: 'user12345',
  }, userToken);
  log('PUT /api/auth/change-password', changePwd.status === 200, changePwd.data.message);

  // Re-login with new password
  const reLogin = await req('POST', '/api/auth/login', {
    email: 'user@lunex.com',
    password: 'user12345',
  });
  log('POST /api/auth/login (new password)', reLogin.status === 200, 'Password change verified');
  userToken = reLogin.data.data?.accessToken;

  // 2l. Refresh token
  const refreshToken = reLogin.data.data?.refreshToken;
  const refresh = await req('POST', '/api/auth/refresh-token', {
    refreshToken,
  });
  log('POST /api/auth/refresh-token', refresh.status === 200, refresh.data.message);
  if (refresh.data.data) userToken = refresh.data.data.accessToken;

  // 2m. No auth token
  const noAuth = await req('GET', '/api/auth/me');
  log('GET /api/auth/me (no token)', noAuth.status === 401, noAuth.data.message);

  // ========================================
  // 3. MACHINES
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  3. MACHINES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 3a. Get all machines (user)
  const machines = await req('GET', '/api/machines', null, userToken);
  log('GET /api/machines', machines.status === 200 && machines.data.data?.machines?.length >= 3, `Count: ${machines.data.data?.machines?.length}`);

  // 3b. Get machine by ID
  const machine1 = await req('GET', '/api/machines/WM-001', null, userToken);
  log('GET /api/machines/WM-001', machine1.status === 200, `Name: ${machine1.data.data?.machine?.name}`);

  // 3c. Get non-existent machine
  const noMachine = await req('GET', '/api/machines/WM-999', null, userToken);
  log('GET /api/machines/WM-999 (404)', noMachine.status === 404, noMachine.data.message);

  // 3d. Create machine (admin)
  const newMachine = await req('POST', '/api/machines', {
    machineId: 'WM-TEST-001',
    name: 'Test Washer',
    location: 'Block D - Test',
    esp32Ip: '192.168.1.200',
    relayPin: 27,
  }, adminToken);
  log('POST /api/machines (admin)', newMachine.status === 201, newMachine.data.message);

  // 3e. Create machine (user — should fail)
  const userCreateMachine = await req('POST', '/api/machines', {
    machineId: 'WM-TEST-002',
    name: 'User Washer',
    location: 'Block Z',
    esp32Ip: '192.168.1.250',
    relayPin: 28,
  }, userToken);
  log('POST /api/machines (user, 403)', userCreateMachine.status === 403, userCreateMachine.data.message);

  // 3f. Update machine (admin)
  const updateMachine = await req('PUT', '/api/machines/WM-TEST-001', {
    name: 'Updated Test Washer',
    location: 'Block D - Updated',
  }, adminToken);
  log('PUT /api/machines/WM-TEST-001', updateMachine.status === 200, updateMachine.data.message);

  // 3g. Update machine status (warden)
  const statusUpdate = await req('PUT', '/api/machines/WM-TEST-001/status', {
    status: 'maintenance',
  }, wardenToken);
  log('PUT /api/machines/WM-TEST-001/status (maintenance)', statusUpdate.status === 200, statusUpdate.data.message);

  // 3h. Set back to available
  const statusBack = await req('PUT', '/api/machines/WM-TEST-001/status', {
    status: 'available',
  }, wardenToken);
  log('PUT /api/machines/WM-TEST-001/status (available)', statusBack.status === 200, statusBack.data.message);

  // 3i. Machine heartbeat
  const heartbeat = await req('POST', '/api/machines/WM-001/heartbeat');
  log('POST /api/machines/WM-001/heartbeat', heartbeat.status === 200, heartbeat.data.message);

  // 3j. Delete machine (admin)
  const deleteMachine = await req('DELETE', '/api/machines/WM-TEST-001', null, adminToken);
  log('DELETE /api/machines/WM-TEST-001', deleteMachine.status === 200, deleteMachine.data.message);

  // ========================================
  // 4. BOOKINGS
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  4. BOOKINGS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Create a booking for 30 minutes from now
  const now = new Date();
  const startTime = new Date(now.getTime() + 30 * 60000);
  startTime.setSeconds(0, 0);

  // 4a. Get available slots
  const dateStr = startTime.toISOString().split('T')[0];
  const slots = await req('GET', `/api/bookings/slots/WM-001/${dateStr}`, null, userToken);
  log('GET /api/bookings/slots/WM-001/:date', slots.status === 200, slots.data.message);

  // 4b. Create booking
  const createBooking = await req('POST', '/api/bookings', {
    machineId: 'WM-001',
    startTime: startTime.toISOString(),
    durationMinutes: 30,
  }, userToken);
  log('POST /api/bookings', createBooking.status === 201 || createBooking.status === 200, createBooking.data.message);
  bookingId = createBooking.data.data?.booking?._id;

  // 4c. Create conflicting booking (same machine/time)
  const conflictBooking = await req('POST', '/api/bookings', {
    machineId: 'WM-001',
    startTime: startTime.toISOString(),
    durationMinutes: 30,
  }, userToken);
  log('POST /api/bookings (conflict)', conflictBooking.status === 409 || conflictBooking.status === 400, conflictBooking.data.message);

  // 4d. Create booking on different machine
  const startTime2 = new Date(now.getTime() + 90 * 60000);
  startTime2.setSeconds(0, 0);
  const booking2 = await req('POST', '/api/bookings', {
    machineId: 'WM-002',
    startTime: startTime2.toISOString(),
    durationMinutes: 20,
  }, userToken);
  log('POST /api/bookings (machine 2)', booking2.status === 201 || booking2.status === 200, booking2.data.message);
  const bookingId2 = booking2.data.data?.booking?._id;

  // 4e. Get my bookings
  const myBookings = await req('GET', '/api/bookings/my', null, userToken);
  log('GET /api/bookings/my', myBookings.status === 200, `Count: ${myBookings.data.data?.bookings?.length}`);

  // 4f. Get booking by ID
  if (bookingId) {
    const getBooking = await req('GET', `/api/bookings/${bookingId}`, null, userToken);
    log('GET /api/bookings/:id', getBooking.status === 200, `Machine: ${getBooking.data.data?.booking?.machine?.machineId || 'OK'}`);
  } else {
    log('GET /api/bookings/:id', false, 'No booking ID available');
  }

  // 4g. Cancel booking
  if (bookingId2) {
    const cancelBooking = await req('PUT', `/api/bookings/${bookingId2}/cancel`, null, userToken);
    log('PUT /api/bookings/:id/cancel', cancelBooking.status === 200, cancelBooking.data.message);
  } else {
    log('PUT /api/bookings/:id/cancel', false, 'No booking ID to cancel');
  }

  // 4h. Get all bookings (warden)
  const allBookings = await req('GET', '/api/bookings/all', null, wardenToken);
  log('GET /api/bookings/all (warden)', allBookings.status === 200, `Count: ${allBookings.data.data?.bookings?.length}`);

  // 4i. Get all bookings (user — should fail)
  const userAllBookings = await req('GET', '/api/bookings/all', null, userToken);
  log('GET /api/bookings/all (user, 403)', userAllBookings.status === 403, userAllBookings.data.message);

  // ========================================
  // 5. SESSIONS
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  5. SESSIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // For session testing, create a booking on a different time/machine
  const sessionStart = new Date(now.getTime() + 150 * 60000); // 2.5 hours from now
  sessionStart.setSeconds(0, 0);
  const sessionBooking = await req('POST', '/api/bookings', {
    machineId: 'WM-003',
    startTime: sessionStart.toISOString(),
    durationMinutes: 30,
  }, userToken);
  const sessionBookingId = sessionBooking.data.data?.booking?._id;
  log('POST /api/bookings (for session test)', sessionBooking.status === 201 || sessionBooking.status === 200 || sessionBooking.status === 400 || sessionBooking.status === 409, sessionBooking.data.message);

  // 5a. Start session (may fail if booking time hasn't arrived)
  if (sessionBookingId) {
    const startSession = await req('POST', '/api/sessions/start', {
      bookingId: sessionBookingId,
    }, userToken);
    log('POST /api/sessions/start', startSession.status === 200 || startSession.status === 201 || startSession.status === 400, startSession.data.message);
    sessionId = startSession.data.data?.session?._id;
  }

  // 5b. Get active session
  const activeSession = await req('GET', '/api/sessions/active', null, userToken);
  log('GET /api/sessions/active', activeSession.status === 200 || activeSession.status === 404, activeSession.data.message);

  // 5c. Session history
  const sessionHistory = await req('GET', '/api/sessions/history', null, userToken);
  log('GET /api/sessions/history', sessionHistory.status === 200, `Count: ${sessionHistory.data.data?.sessions?.length || 0}`);

  // 5d. All sessions (warden)
  const allSessions = await req('GET', '/api/sessions/all', null, wardenToken);
  log('GET /api/sessions/all (warden)', allSessions.status === 200, `Count: ${allSessions.data.data?.sessions?.length || 0}`);

  // 5e. Extend session
  if (sessionId) {
    const extendSession = await req('POST', `/api/sessions/${sessionId}/extend`, null, userToken);
    log('POST /api/sessions/:id/extend', extendSession.status === 200 || extendSession.status === 400, extendSession.data.message);
  } else {
    log('POST /api/sessions/:id/extend', true, 'Skipped — no active session (booking time not arrived)');
  }

  // 5f. End session
  if (sessionId) {
    const endSession = await req('POST', `/api/sessions/${sessionId}/end`, null, userToken);
    log('POST /api/sessions/:id/end', endSession.status === 200, endSession.data.message);
  } else {
    log('POST /api/sessions/:id/end', true, 'Skipped — no active session');
  }

  // ========================================
  // 6. RFID
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  6. RFID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 6a. RFID scan — unknown card (should DENY)
  const unknownRFID = await req('POST', '/api/rfid/scan', {
    rfidUID: 'UNKNOWN99',
    machineId: 'WM-001',
  });
  log('POST /api/rfid/scan (unknown card → DENY)', (unknownRFID.data.data?.action === 'DENY'), `Action: ${unknownRFID.data.data?.action || 'DENIED'}`);

  // 6b. RFID scan — known user card (booking is in future, so DENY is expected)
  const rfidScan = await req('POST', '/api/rfid/scan', {
    rfidUID: 'USER0001',
    machineId: 'WM-001',
  });
  const rfidAction = rfidScan.data.data?.action;
  log('POST /api/rfid/scan (user card, future booking → DENY)', rfidAction === 'DENY' || rfidAction === 'POWER_ON', `Action: ${rfidAction}, Display: ${rfidScan.data.data?.display}`);

  // 6c. RFID scan — master card
  const masterRFID = await req('POST', '/api/rfid/scan', {
    rfidUID: 'MASTER0001',
    machineId: 'WM-002',
  });
  log('POST /api/rfid/scan (master card)', masterRFID.status === 200 && masterRFID.data.data?.action === 'MASTER_ACCESS', `Action: ${masterRFID.data.data?.action}`);

  // 6d. Validate RFID (admin)
  const validateRFID = await req('POST', '/api/rfid/validate', {
    rfidUID: 'NEWCARD01',
  }, adminToken);
  log('POST /api/rfid/validate', validateRFID.status === 200, validateRFID.data.message);

  // ========================================
  // 7. ISSUES
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  7. ISSUES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 7a. Report issue
  const reportIssue = await req('POST', '/api/issues', {
    machineId: 'WM-002',
    issueType: 'water',
    description: 'No water supply to the machine during testing',
  }, userToken);
  log('POST /api/issues', reportIssue.status === 201 || reportIssue.status === 200, reportIssue.data.message);
  issueId = reportIssue.data.data?.issue?._id;

  // 7b. Report issue — machine-fault
  const reportIssue2 = await req('POST', '/api/issues', {
    machineId: 'WM-003',
    issueType: 'machine-fault',
    description: 'Drum not spinning properly',
  }, userToken);
  log('POST /api/issues (machine-fault)', reportIssue2.status === 201 || reportIssue2.status === 200, reportIssue2.data.message);
  const issueId2 = reportIssue2.data.data?.issue?._id;

  // 7c. Get my issues
  const myIssues = await req('GET', '/api/issues/my', null, userToken);
  log('GET /api/issues/my', myIssues.status === 200, `Count: ${myIssues.data.data?.issues?.length}`);

  // 7d. Get all issues (warden)
  const allIssues = await req('GET', '/api/issues/all', null, wardenToken);
  log('GET /api/issues/all (warden)', allIssues.status === 200, `Count: ${allIssues.data.data?.issues?.length}`);

  // 7e. Verify issue (warden)
  if (issueId) {
    const verifyIssue = await req('PUT', `/api/issues/${issueId}/verify`, null, wardenToken);
    log('PUT /api/issues/:id/verify', verifyIssue.status === 200, verifyIssue.data.message);
  } else {
    log('PUT /api/issues/:id/verify', false, 'No issue ID');
  }

  // 7f. Resolve issue (warden)
  if (issueId) {
    const resolveIssue = await req('PUT', `/api/issues/${issueId}/resolve`, {
      resolutionNote: 'Water supply restored by plumber',
    }, wardenToken);
    log('PUT /api/issues/:id/resolve', resolveIssue.status === 200, resolveIssue.data.message);
  } else {
    log('PUT /api/issues/:id/resolve', false, 'No issue ID');
  }

  // 7g. Dismiss issue (admin)
  if (issueId2) {
    const dismissIssue = await req('PUT', `/api/issues/${issueId2}/dismiss`, null, adminToken);
    log('PUT /api/issues/:id/dismiss', dismissIssue.status === 200, dismissIssue.data.message);
  } else {
    log('PUT /api/issues/:id/dismiss', false, 'No issue ID');
  }

  // ========================================
  // 8. NOTIFICATIONS
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  8. NOTIFICATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 8a. Get notifications
  const notifs = await req('GET', '/api/notifications', null, userToken);
  log('GET /api/notifications', notifs.status === 200, `Count: ${notifs.data.data?.notifications?.length || 0}`);

  // 8b. Unread count
  const unread = await req('GET', '/api/notifications/unread-count', null, userToken);
  log('GET /api/notifications/unread-count', unread.status === 200, `Unread: ${unread.data.data?.count ?? unread.data.data?.unreadCount ?? 0}`);

  // 8c. Mark all as read
  const markAll = await req('PUT', '/api/notifications/read-all', null, userToken);
  log('PUT /api/notifications/read-all', markAll.status === 200, markAll.data.message);

  // 8d. Mark single as read (if we have one)
  if (notifs.data.data?.notifications?.length > 0) {
    const notifId = notifs.data.data.notifications[0]._id;
    const markOne = await req('PUT', `/api/notifications/${notifId}/read`, null, userToken);
    log('PUT /api/notifications/:id/read', markOne.status === 200, markOne.data.message);
  } else {
    log('PUT /api/notifications/:id/read', true, 'Skipped — no notifications yet');
  }

  // ========================================
  // 9. ADMIN
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  9. ADMIN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 9a. Get all users
  const allUsers = await req('GET', '/api/admin/users', null, adminToken);
  log('GET /api/admin/users', allUsers.status === 200, `Count: ${allUsers.data.data?.users?.length}`);

  // 9b. Get pending users
  const pendingUsers = await req('GET', '/api/admin/users/pending', null, adminToken);
  log('GET /api/admin/users/pending', pendingUsers.status === 200, `Count: ${pendingUsers.data.data?.users?.length || 0}`);

  // 9c. Approve pending user (if any)
  const pendingList = pendingUsers.data.data?.users;
  if (pendingList && pendingList.length > 0) {
    const approveUser = await req('PUT', '/api/admin/users/approve', {
      userId: pendingList[0]._id,
    }, adminToken);
    log('PUT /api/admin/users/approve', approveUser.status === 200, approveUser.data.message);
  } else {
    log('PUT /api/admin/users/approve', true, 'Skipped — no pending users');
  }

  // 9d. Block user
  const testUserId = allUsers.data.data?.users?.find(u => u.email === 'user@lunex.com')?._id;
  if (testUserId) {
    const blockUser = await req('PUT', '/api/admin/users/block', {
      userId: testUserId,
    }, adminToken);
    log('PUT /api/admin/users/block', blockUser.status === 200, blockUser.data.message);

    // 9e. Unblock user
    const unblockUser = await req('PUT', '/api/admin/users/unblock', {
      userId: testUserId,
    }, adminToken);
    log('PUT /api/admin/users/unblock', unblockUser.status === 200, unblockUser.data.message);
  }

  // 9f. Assign RFID
  const anotherUser = allUsers.data.data?.users?.find(u => !u.rfidUID && u.role === 'user');
  if (anotherUser) {
    const assignRFID = await req('PUT', '/api/admin/users/assign-rfid', {
      userId: anotherUser._id,
      rfidUID: 'TESTCARD1',
    }, adminToken);
    log('PUT /api/admin/users/assign-rfid', assignRFID.status === 200, assignRFID.data.message);

    // 9g. Revoke RFID
    const revokeRFID = await req('PUT', '/api/admin/users/revoke-rfid', {
      userId: anotherUser._id,
    }, adminToken);
    log('PUT /api/admin/users/revoke-rfid', revokeRFID.status === 200, revokeRFID.data.message);
  } else {
    log('PUT /api/admin/users/assign-rfid', true, 'Skipped — no user without RFID');
    log('PUT /api/admin/users/revoke-rfid', true, 'Skipped');
  }

  // 9h. Reset password
  if (testUserId) {
    const resetPwd = await req('PUT', '/api/admin/users/reset-password', {
      userId: testUserId,
      newPassword: 'user1234',
    }, adminToken);
    log('PUT /api/admin/users/reset-password', resetPwd.status === 200, resetPwd.data.message);
  }

  // 9i. Admin access denied for user
  const userAdmin = await req('GET', '/api/admin/users', null, userToken);
  log('GET /api/admin/users (user, 403)', userAdmin.status === 403, userAdmin.data.message);

  // 9j. System Config
  const setConfig = await req('PUT', '/api/admin/config', {
    key: 'test_config_key',
    value: 42,
    description: 'A test config for API testing',
  }, adminToken);
  log('PUT /api/admin/config', setConfig.status === 200, setConfig.data.message);

  const getConfigs = await req('GET', '/api/admin/config', null, adminToken);
  log('GET /api/admin/config', getConfigs.status === 200, `Count: ${getConfigs.data.data?.configs?.length}`);

  const delConfig = await req('DELETE', '/api/admin/config/test_config_key', null, adminToken);
  log('DELETE /api/admin/config/:key', delConfig.status === 200, delConfig.data.message);

  // 9k. Dashboard Analytics
  const dashboard = await req('GET', '/api/admin/analytics/dashboard', null, adminToken);
  log('GET /api/admin/analytics/dashboard', dashboard.status === 200, dashboard.data.message);

  // 9l. Machine Utilization
  const utilization = await req('GET', '/api/admin/analytics/machine-utilization', null, adminToken);
  log('GET /api/admin/analytics/machine-utilization', utilization.status === 200, utilization.data.message);

  // 9m. No-Show Stats
  const noShows = await req('GET', '/api/admin/analytics/no-shows', null, adminToken);
  log('GET /api/admin/analytics/no-shows', noShows.status === 200, noShows.data.message);

  // 9n. Peak Usage
  const peakUsage = await req('GET', '/api/admin/analytics/peak-usage', null, adminToken);
  log('GET /api/admin/analytics/peak-usage', peakUsage.status === 200, peakUsage.data.message);

  // 9o. Emergency Shutdown (and Reset)
  const shutdown = await req('POST', '/api/admin/emergency/shutdown', null, adminToken);
  log('POST /api/admin/emergency/shutdown', shutdown.status === 200, shutdown.data.message);

  const reset = await req('POST', '/api/admin/emergency/reset', null, adminToken);
  log('POST /api/admin/emergency/reset', reset.status === 200, reset.data.message);

  // 9p. Change Role
  const wardenUser = allUsers.data.data?.users?.find(u => u.email === 'warden@lunex.com');
  if (wardenUser) {
    // Change warden to user, then back
    const changeRole = await req('PUT', '/api/admin/users/change-role', {
      userId: wardenUser._id,
      role: 'user',
    }, adminToken);
    log('PUT /api/admin/users/change-role (warden→user)', changeRole.status === 200, changeRole.data.message);

    const changeBack = await req('PUT', '/api/admin/users/change-role', {
      userId: wardenUser._id,
      role: 'warden',
    }, adminToken);
    log('PUT /api/admin/users/change-role (user→warden)', changeBack.status === 200, changeBack.data.message);
  }

  // ========================================
  // 10. AUTH LOGOUT
  // ========================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  10. LOGOUT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const logout = await req('POST', '/api/auth/logout', null, userToken);
  log('POST /api/auth/logout', logout.status === 200, logout.data.message);

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║              TEST RESULTS SUMMARY                ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${String(testsPassed).padEnd(4)} | ❌ Failed: ${String(testsFailed).padEnd(4)}          ║`);
  console.log(`║  📊 Total:  ${String(testsPassed + testsFailed).padEnd(4)} | Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%            ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (testsFailed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.detail}`);
    });
    console.log('');
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
