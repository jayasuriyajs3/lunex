# LUNEX — Complete Project Documentation

> **"Book Smart. Wash Easy. Live Better."**

**Version:** 1.0.0  
**Last Updated:** February 24, 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [System Flow & How It Works](#4-system-flow--how-it-works)
5. [Backend Documentation](#5-backend-documentation)
   - [Directory Structure](#51-directory-structure)
   - [Database Models](#52-database-models)
   - [API Endpoints](#53-api-endpoints)
   - [Middleware](#54-middleware)
   - [Services](#55-services)
   - [Cron Jobs](#56-cron-jobs)
   - [Constants & Enums](#57-constants--enums)
   - [Environment Variables](#58-environment-variables)
6. [Frontend Documentation](#6-frontend-documentation)
   - [Directory Structure](#61-directory-structure)
   - [Pages & Components](#62-pages--components)
   - [Routing & Navigation](#63-routing--navigation)
   - [API Service Layer](#64-api-service-layer)
   - [Authentication Flow](#65-authentication-flow)
7. [Hardware Integration (ESP32 + RFID)](#7-hardware-integration-esp32--rfid)
8. [Roles & Permissions](#8-roles--permissions)
9. [Key Business Logic](#9-key-business-logic)
10. [Setup & Installation](#10-setup--installation)
11. [Seed Data & Test Credentials](#11-seed-data--test-credentials)

---

## 1. Project Overview

**LUNEX** (Laundry & Utility Nexus) is a full-stack IoT-integrated smart laundry management system designed for college hostels. It allows hostel residents to book washing machine time slots, authenticate via RFID cards at the machine, and manage their washing sessions — all through a modern web interface with real-time notifications.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Slot Booking** | Users book 15–60 minute slots on available machines up to 7 days in advance |
| **RFID Authentication** | Physical RFID cards scanned at ESP32-connected machines to start/end sessions |
| **Live Session Tracking** | Real-time countdown timer, session extension (+5 min), early end |
| **Issue Reporting** | Report water/power/machine faults; sessions auto-pause during issues |
| **Priority Rebooking** | Users affected by machine faults get priority access to the next available slot |
| **Admin Dashboard** | Analytics, user management, machine management, emergency controls |
| **No-Show Detection** | Auto-cancels bookings if user doesn't arrive within the grace period |
| **Notifications** | In-app notifications for booking confirmations, reminders, session events |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  React 19 · React Router 7 · Tailwind CSS 4 · Axios · Recharts │
│  Port: 5173 (dev)                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP (REST API)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                 │
│  Express 4 · Mongoose 9 · JWT Auth · Cron Jobs · Rate Limiting  │
│  Port: 5000                                                     │
└────────┬──────────────────────────────────┬─────────────────────┘
         │                                  │
         ▼                                  ▼
┌──────────────────┐              ┌──────────────────┐
│    MongoDB        │              │   ESP32 + RFID    │
│  (Database)       │              │   (IoT Hardware)  │
│  8 Collections    │              │  RC522 Reader     │
└──────────────────┘              │  Relay Module     │
                                  └──────────────────┘
```

### Communication Patterns

- **Frontend → Backend:** REST API via Axios with JWT Bearer tokens
- **ESP32 → Backend:** HTTP POST to `/api/rfid/scan` (RFID UID + Machine ID)
- **ESP32 ← Backend:** JSON response with action instructions (`POWER_ON`, `POWER_OFF`, `DENY`)
- **ESP32 → Backend:** Periodic heartbeat POST to `/api/machines/:machineId/heartbeat`

---

## 3. Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | — | Runtime |
| Express | 4.22 | Web framework |
| Mongoose | 9.2 | MongoDB ODM |
| JSON Web Token | 9.0 | Authentication |
| bcryptjs | 3.0 | Password hashing |
| node-cron | 4.2 | Scheduled tasks |
| Joi | 18.0 | Request validation |
| Helmet | 8.1 | Security headers |
| CORS | 2.8 | Cross-origin support |
| express-rate-limit | 8.2 | Rate limiting |
| Morgan | 1.10 | HTTP request logging |
| dotenv | 17.3 | Environment variables |
| firebase-admin | 13.6 | Push notifications (FCM) |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI library |
| Vite | 7.3 | Build tool & dev server |
| React Router | 7.13 | Client-side routing |
| Tailwind CSS | 4.2 | Utility-first styling |
| Axios | 1.13 | HTTP client |
| Recharts | 3.7 | Charts (admin analytics) |
| Lucide React | 0.575 | Icon library |
| React Hot Toast | 2.6 | Toast notifications |
| date-fns | 4.1 | Date formatting |

### Database
| Technology | Purpose |
|------------|---------|
| MongoDB | Document database — 8 collections |

### Hardware (IoT)
| Component | Purpose |
|-----------|---------|
| ESP32 | Microcontroller with WiFi |
| RC522 RFID Reader | Read RFID card UIDs |
| Relay Module | Switch washing machine power |

---

## 4. System Flow & How It Works

### 4.1 User Registration & Approval Flow

```
User registers → Account status = "pending"
       ↓
Admin reviews → Approves (status = "active") or Rejects
       ↓
Admin assigns RFID card → User can now book slots
```

1. User fills the registration form (name, email, phone, room, hostel block, password)
2. Account is created with `accountStatus: "pending"`
3. User sees a "Pending Approval" page and cannot access the system
4. Admin views pending users in the User Management page
5. Admin approves the user → `accountStatus: "active"` + notification sent
6. Admin assigns an RFID UID to the user's account
7. User can now log in and book machine slots

### 4.2 Booking Flow

```
User selects machine → Picks date → Picks time slot → Confirms booking
       ↓
Booking created (status = "confirmed")
       ↓
Notification sent: "Booking Confirmed"
```

**Validation rules applied during booking:**
- User must have an RFID card assigned
- Machine must be in `available` or `in-use` status (not maintenance/repair/disabled)
- Start time must be in the future
- Cannot book more than 7 days in advance (`MAX_ADVANCE_BOOKING_DAYS`)
- Maximum 3 bookings per user per day (`MAX_BOOKINGS_PER_DAY`)
- Duration: 10–60 minutes
- No overlapping slots (includes 10-minute buffer between slots)
- User cannot have another booking at the same time

### 4.3 RFID Scan & Session Start Flow

```
User taps RFID card on ESP32 reader at the machine
       ↓
ESP32 sends POST /api/rfid/scan { rfidUID, machineId }
       ↓
Server validates:
  ├─ RFID recognized? → Find user
  ├─ Account active? → Check status
  ├─ Machine available? → Check if in-use
  └─ Valid booking? → Within grace period window
       ↓
Session created (status = "running")
Machine updated (status = "in-use")
Booking updated (status = "active")
       ↓
Response to ESP32: { action: "POWER_ON", duration: 30, display: "Welcome Jay" }
       ↓
ESP32 activates relay → Machine powers on
```

### 4.4 Session Lifecycle

```
┌─────────────────────────────────────────────────┐
│  RUNNING ──────┬───────────────→ COMPLETED      │
│    │           │ (auto-end / user-end / RFID)   │
│    │           │                                │
│    ├──→ PAUSED ┤ (warden pauses for issue)      │
│    │     │     │                                │
│    │     └─────┘ (resume after issue resolved)  │
│    │                                            │
│    └──→ TERMINATED (force stop by warden/admin) │
│    └──→ INTERRUPTED (machine fault)             │
└─────────────────────────────────────────────────┘
```

**During a session, users can:**
- **View live countdown** — circular progress ring with MM:SS timer
- **Extend by 5 minutes** — one-time extension if the next slot is free
- **End early** — via the web app or by tapping RFID again at the machine

**The system automatically:**
- Sends a "5 minutes remaining" notification
- Auto-ends the session when time expires

### 4.5 No-Show Detection Flow

```
Booking start time passes → Cron checks every minute
       ↓
+5 min: Reminder notification sent ("Arrive now!")
       ↓
+10 min (grace period): Booking marked as "no-show"
  → User's noShowCount incremented
  → Machine freed up
  → "Booking cancelled due to no-show" notification
```

### 4.6 Issue Reporting & Priority Rebook Flow

```
User reports issue (water/power/machine-fault)
       ↓
If active session exists → Session auto-paused
       ↓
Warden/Admin verifies the issue
       ↓
Warden resolves → Session auto-resumes (paused time added to end)
       OR
Warden offers priority rebook
       ↓
System finds next available slot on any machine
       ↓
User receives offer → Accept (auto-books) or Decline
       ↓
Offer expires in 30 minutes if no response
```

---

## 5. Backend Documentation

### 5.1 Directory Structure

```
backend/
├── package.json                 # Dependencies & scripts
├── .env                         # Environment variables (not in git)
├── src/
│   ├── server.js                # Server entry point (connects DB, starts app)
│   ├── app.js                   # Express app configuration (routes, middleware)
│   ├── seed.js                  # Database seeder (admin, warden, machines, configs)
│   ├── config/
│   │   ├── db.js                # MongoDB connection
│   │   └── constants.js         # All enums (roles, statuses, types)
│   ├── models/                  # Mongoose schemas (8 models)
│   │   ├── User.js
│   │   ├── Machine.js
│   │   ├── Booking.js
│   │   ├── Session.js
│   │   ├── Issue.js
│   │   ├── Notification.js
│   │   ├── PriorityRebook.js
│   │   └── SystemConfig.js
│   ├── controllers/             # Request handlers
│   │   ├── authController.js
│   │   ├── bookingController.js
│   │   ├── sessionController.js
│   │   ├── machineController.js
│   │   ├── issueController.js
│   │   ├── notificationController.js
│   │   ├── rfidController.js
│   │   └── adminController.js
│   ├── routes/                  # Express route definitions
│   │   ├── authRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── sessionRoutes.js
│   │   ├── machineRoutes.js
│   │   ├── issueRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── rfidRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── auth.js              # JWT verification (protect, protectAllowPending)
│   │   ├── authorize.js         # Role-based access control
│   │   ├── errorHandler.js      # Global error handler
│   │   └── validate.js          # Joi schema validation
│   ├── services/
│   │   ├── bookingService.js    # Slot availability, conflict detection
│   │   └── notificationService.js # Create & bulk-create notifications
│   ├── cron/
│   │   └── cronJobs.js          # 5 scheduled tasks
│   ├── utils/
│   │   ├── AppError.js          # Custom error class
│   │   ├── asyncHandler.js      # Async/await error wrapper
│   │   ├── dateHelpers.js       # Date utility functions
│   │   └── sendResponse.js      # Standardized API response
│   └── validators/              # Joi validation schemas
│       ├── authValidator.js
│       ├── bookingValidator.js
│       ├── machineValidator.js
│       ├── issueValidator.js
│       └── adminValidator.js
```

### 5.2 Database Models

#### User

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Full name (2–100 chars) |
| `email` | String | Unique, lowercase email |
| `phone` | String | Phone number |
| `password` | String | Bcrypt-hashed (12 salt rounds), not returned in queries |
| `role` | String | `user` / `warden` / `admin` |
| `accountStatus` | String | `pending` / `active` / `blocked` / `rejected` |
| `rfidUID` | String | Unique RFID card identifier (sparse index) |
| `roomNumber` | String | Hostel room number |
| `hostelBlock` | String | Hostel block identifier |
| `noShowCount` | Number | Number of no-show incidents |
| `totalBookings` | Number | Lifetime booking count |
| `totalSessions` | Number | Lifetime session count |
| `hasPriorityRebook` | Boolean | Currently offered a priority rebook |
| `fcmToken` | String | Firebase Cloud Messaging token (for push notifications) |
| `refreshToken` | String | JWT refresh token (not returned in queries) |
| `lastLogin` | Date | Last login timestamp |
| `approvedBy` | ObjectId → User | Who approved this account |
| `approvedAt` | Date | When account was approved |

**Pre-save hook:** Hashes password with bcrypt (12 rounds)  
**Instance methods:** `comparePassword(candidate)`, `toJSON()` (strips password & refreshToken)

#### Machine

| Field | Type | Description |
|-------|------|-------------|
| `machineId` | String | Unique human-readable ID (e.g., `WM-001`) |
| `name` | String | Display name (e.g., "Washer 1") |
| `location` | String | Physical location (e.g., "Block A - Ground Floor") |
| `status` | String | `available` / `in-use` / `maintenance` / `repair` / `disabled` |
| `esp32Ip` | String | IP address of the connected ESP32 |
| `relayPin` | Number | GPIO pin number for relay control |
| `isOnline` | Boolean | Whether ESP32 is sending heartbeats |
| `lastHeartbeat` | Date | Last heartbeat timestamp |
| `currentBooking` | ObjectId → Booking | Currently active booking |
| `currentSession` | ObjectId → Session | Currently active session |
| `totalUsageCount` | Number | Lifetime usage count |
| `totalUsageMinutes` | Number | Lifetime usage in minutes |
| `maintenanceNote` | String | Note when in maintenance/repair |
| `lastMaintenanceDate` | Date | Last maintenance date |
| `addedBy` | ObjectId → User | Admin who created this machine |

#### Booking

| Field | Type | Description |
|-------|------|-------------|
| `user` | ObjectId → User | Who made the booking |
| `machine` | ObjectId → Machine | Which machine |
| `slotDate` | Date | Date of the booking (start of day) |
| `startTime` | Date | Slot start datetime |
| `endTime` | Date | Slot end datetime |
| `durationMinutes` | Number | Duration (10–60 min) |
| `status` | String | `confirmed` / `active` / `completed` / `cancelled` / `no-show` / `interrupted` |
| `rfidScannedAt` | Date | When user scanned RFID |
| `arrivedAt` | Date | When user arrived |
| `cancelledAt` | Date | When booking was cancelled |
| `cancelReason` | String | Reason for cancellation |
| `noShowAt` | Date | When marked as no-show |
| `reminderSentAt` | Date | When arrival reminder was sent |
| `isPriorityBooking` | Boolean | Created via priority rebook |
| `session` | ObjectId → Session | Linked session (after RFID scan) |

**Indexes:** `{machine, startTime, endTime}`, `{user, slotDate}`, `{status, startTime}`

#### Session

| Field | Type | Description |
|-------|------|-------------|
| `booking` | ObjectId → Booking | Source booking |
| `user` | ObjectId → User | Session owner |
| `machine` | ObjectId → Machine | Which machine |
| `status` | String | `running` / `paused` / `completed` / `terminated` / `interrupted` |
| `startedAt` | Date | Session start time |
| `scheduledEndAt` | Date | Original end time |
| `actualEndAt` | Date | Actual end time |
| `pausedAt` | Date | When paused |
| `resumedAt` | Date | When resumed |
| `totalPausedMinutes` | Number | Total time spent paused |
| `extensionGranted` | Boolean | Whether +5 min extension was used |
| `extensionMinutes` | Number | Extension duration (default 5) |
| `extendedEndAt` | Date | New end time after extension/resume |
| `powerOnAt` | Date | When power relay was activated |
| `powerOffAt` | Date | When power relay was deactivated |
| `durationMinutes` | Number | Actual session duration |
| `interruptedBy` | ObjectId → Issue | Issue that caused interruption |
| `terminatedBy` | String | `system` / `user` / `warden` / `admin` / `auto` |

#### Issue

| Field | Type | Description |
|-------|------|-------------|
| `reportedBy` | ObjectId → User | Who reported |
| `machine` | ObjectId → Machine | Affected machine |
| `booking` | ObjectId → Booking | Related booking (optional) |
| `session` | ObjectId → Session | Related session (optional) |
| `issueType` | String | `water` / `power` / `machine-fault` / `other` |
| `description` | String | Issue description (max 500 chars) |
| `status` | String | `reported` / `verified` / `resolved` / `dismissed` |
| `verifiedBy` | ObjectId → User | Warden who verified |
| `verifiedAt` | Date | Verification timestamp |
| `resolvedBy` | ObjectId → User | Who resolved |
| `resolvedAt` | Date | Resolution timestamp |
| `resolutionNote` | String | Resolution details |
| `sessionPaused` | Boolean | Whether session was auto-paused |
| `priorityRebookOffered` | Boolean | Whether priority rebook was offered |

#### Notification

| Field | Type | Description |
|-------|------|-------------|
| `user` | ObjectId → User | Recipient |
| `type` | String | One of 16 notification types (see Constants) |
| `title` | String | Notification title |
| `message` | String | Notification body |
| `data` | Mixed | Additional metadata (bookingId, sessionId, etc.) |
| `isRead` | Boolean | Read status |
| `readAt` | Date | When read |
| `sentViaPush` | Boolean | Whether sent via FCM push |

#### PriorityRebook

| Field | Type | Description |
|-------|------|-------------|
| `user` | ObjectId → User | Affected user |
| `originalBooking` | ObjectId → Booking | The interrupted booking |
| `issue` | ObjectId → Issue | The reported issue |
| `offeredSlot.machine` | ObjectId → Machine | Offered machine |
| `offeredSlot.startTime` | Date | Offered start time |
| `offeredSlot.endTime` | Date | Offered end time |
| `status` | String | `offered` / `accepted` / `declined` / `expired` / `completed` |
| `newBooking` | ObjectId → Booking | New booking if accepted |
| `respondedAt` | Date | When user responded |
| `expiresAt` | Date | Offer expiration (30 min) |

#### SystemConfig

| Field | Type | Description |
|-------|------|-------------|
| `key` | String | Config key (unique) |
| `value` | Mixed | Config value |
| `description` | String | Human-readable description |
| `updatedBy` | ObjectId → User | Last updated by |

### 5.3 API Endpoints

#### Authentication (`/api/auth`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/register` | Public | Register new user |
| `POST` | `/login` | Public | Login & get JWT tokens |
| `POST` | `/refresh-token` | Public | Refresh expired access token |
| `GET` | `/status` | Auth (allows pending) | Check account status |
| `GET` | `/me` | Auth | Get current user profile |
| `PUT` | `/profile` | Auth | Update profile (name, phone, room, block) |
| `PUT` | `/change-password` | Auth | Change password |
| `POST` | `/logout` | Auth | Logout (clears refresh token) |

#### Bookings (`/api/bookings`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/` | User, Warden, Admin | Create new booking |
| `GET` | `/my` | User, Warden, Admin | Get current user's bookings |
| `GET` | `/slots/:machineId/:date` | Auth | Get booked/available slots for a machine on a date |
| `GET` | `/all` | Warden, Admin | Get all bookings (admin view) |
| `GET` | `/:id` | Auth | Get booking by ID (users see own only) |
| `PUT` | `/:id/cancel` | Auth | Cancel a confirmed booking |

#### Sessions (`/api/sessions`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/start` | User, Warden, Admin | Start a session (from booking) |
| `GET` | `/active` | User, Warden, Admin | Get current user's active session |
| `POST` | `/:id/extend` | User, Warden, Admin | Extend session by 5 minutes (one-time) |
| `POST` | `/:id/end` | Auth | End a session (user ends own, staff ends any) |
| `GET` | `/history` | User, Warden, Admin | Get session history |
| `POST` | `/:id/pause` | Warden, Admin | Pause a running session |
| `POST` | `/:id/resume` | Warden, Admin | Resume a paused session |
| `POST` | `/:id/force-stop` | Warden, Admin | Force stop a session |
| `GET` | `/all` | Warden, Admin | Get all sessions |

#### Machines (`/api/machines`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Auth | Get all machines |
| `GET` | `/:machineId` | Auth | Get machine by ID |
| `POST` | `/` | Admin | Create new machine |
| `PUT` | `/:machineId` | Admin | Update machine details |
| `PUT` | `/:machineId/status` | Warden, Admin | Update machine status (with cascading effects) |
| `DELETE` | `/:machineId` | Admin | Delete a machine |
| `POST` | `/:machineId/heartbeat` | Public (ESP32) | ESP32 heartbeat |

#### RFID (`/api/rfid`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/scan` | Public (ESP32) | Scan RFID — validates user, starts/ends session |
| `POST` | `/validate` | Admin | Check if RFID UID is already assigned |

#### Issues (`/api/issues`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/` | User | Report an issue |
| `GET` | `/my` | User | Get current user's issues |
| `GET` | `/priority-rebook/pending` | User | Get pending priority rebook offers |
| `PUT` | `/priority-rebook/:id/respond` | User | Accept/decline priority rebook |
| `GET` | `/all` | Warden, Admin | Get all issues |
| `PUT` | `/:id/verify` | Warden, Admin | Verify a reported issue |
| `PUT` | `/:id/resolve` | Warden, Admin | Resolve an issue |
| `PUT` | `/:id/dismiss` | Warden, Admin | Dismiss an issue |
| `POST` | `/:id/priority-rebook` | Warden, Admin | Offer priority rebooking |

#### Notifications (`/api/notifications`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/` | Auth | Get all notifications (with pagination) |
| `GET` | `/unread-count` | Auth | Get unread notification count |
| `PUT` | `/read-all` | Auth | Mark all as read |
| `PUT` | `/:id/read` | Auth | Mark one as read |
| `DELETE` | `/:id` | Auth | Delete a notification |

#### Admin (`/api/admin`) — All Admin-only

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | Get all users (with search & filters) |
| `GET` | `/users/pending` | Get pending registrations |
| `PUT` | `/users/approve` | Approve a user |
| `PUT` | `/users/reject` | Reject a user |
| `PUT` | `/users/block` | Block a user (cancels upcoming bookings) |
| `PUT` | `/users/unblock` | Unblock a user |
| `PUT` | `/users/assign-rfid` | Assign RFID card to user |
| `PUT` | `/users/revoke-rfid` | Remove RFID from user |
| `PUT` | `/users/change-role` | Change user role |
| `PUT` | `/users/reset-password` | Reset a user's password |
| `GET` | `/config` | Get all system configs |
| `PUT` | `/config` | Set/update a system config |
| `DELETE` | `/config/:key` | Delete a system config |
| `POST` | `/emergency/shutdown` | Emergency shutdown all machines |
| `POST` | `/emergency/reset` | Re-enable all disabled machines |
| `GET` | `/analytics/dashboard` | Dashboard analytics (users, machines, today's stats) |
| `GET` | `/analytics/machine-utilization` | Machine utilization report |
| `GET` | `/analytics/no-shows` | No-show statistics |
| `GET` | `/analytics/peak-usage` | Peak usage by hour/day |

### 5.4 Middleware

#### `auth.js` — JWT Authentication
- **`protect`**: Verifies Bearer JWT token, loads user from DB, blocks `blocked` and `pending` accounts
- **`protectAllowPending`**: Same as `protect` but allows pending users (used for `/auth/status`)

#### `authorize.js` — Role Authorization
- `authorize(...roles)`: Only allows requests from users with specified roles
- Returns 403 if role doesn't match

#### `validate.js` — Request Validation
- Wraps Joi schemas to validate `req.body`
- Returns 400 with field-level error messages on validation failure

#### `errorHandler.js` — Global Error Handler
- Catches all errors thrown in controllers
- Formats Mongoose validation errors, duplicate key errors, cast errors
- Returns structured JSON error response with stack trace in development

### 5.5 Services

#### `bookingService.js`
- **`isSlotAvailable(machineId, start, end, excludeBookingId)`**: Checks for conflicting bookings including buffer time
- **`getUserBookingCountForDate(userId, date)`**: Counts non-cancelled bookings for a user on a given date
- **`findNextAvailableSlot(machineId, duration, afterTime)`**: Finds the next open slot on a machine (used for priority rebooking)

#### `notificationService.js`
- **`createNotification(userId, type, title, message, data)`**: Creates a single notification
- **`createBulkNotifications(userIds, type, title, message, data)`**: Creates notifications for multiple users (used for machine status changes)

### 5.6 Cron Jobs

All cron jobs run automatically when the server starts.

| Job | Schedule | Action |
|-----|----------|--------|
| **No-Show Detection** | Every minute | Checks confirmed bookings past start time. Sends reminder at 5 min. Auto-cancels at 10 min (grace period). Increments user's `noShowCount`. |
| **Auto-End Sessions** | Every minute | Finds running sessions past their scheduled/extended end time. Sets status to `completed`, frees machine, updates usage stats. |
| **Session Ending Reminder** | Every minute | Sends "ending in ~5 minutes" notification to users with running sessions about to expire. |
| **Expire Priority Rebooks** | Every 5 minutes | Sets `offered` priority rebook offers past their `expiresAt` to `expired`. |
| **Machine Heartbeat Check** | Every 5 minutes | Marks machines as `isOnline: false` if no heartbeat received in the last 10 minutes. |

### 5.7 Constants & Enums

```
ROLES:                  user, warden, admin
ACCOUNT_STATUS:         pending, active, blocked, rejected
MACHINE_STATUS:         available, in-use, maintenance, repair, disabled
BOOKING_STATUS:         confirmed, active, completed, cancelled, no-show, interrupted
SESSION_STATUS:         running, paused, completed, terminated, interrupted
ISSUE_TYPES:            water, power, machine-fault, other
ISSUE_STATUS:           reported, verified, resolved, dismissed
PRIORITY_REBOOK_STATUS: offered, accepted, declined, expired, completed

NOTIFICATION_TYPES:     booking-confirmed, arrival-reminder, no-show-warning,
                        slot-released, session-started, session-ending,
                        session-completed, extension-granted, maintenance-alert,
                        issue-reported, issue-resolved, priority-rebook,
                        account-approved, account-blocked, rfid-assigned, emergency
```

### 5.8 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `MONGO_URI` | — | MongoDB connection string |
| `JWT_SECRET` | — | Secret for access tokens |
| `JWT_REFRESH_SECRET` | — | Secret for refresh tokens |
| `JWT_EXPIRES_IN` | `7d` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token expiry |
| `GRACE_PERIOD_MINUTES` | `10` | Minutes to arrive before no-show |
| `REMINDER_BEFORE_MINUTES` | `5` | Minutes after start to send arrival reminder |
| `BUFFER_BETWEEN_SLOTS_MINUTES` | `10` | Buffer between bookings |
| `MAX_BOOKINGS_PER_DAY` | `3` | Max bookings per user per day |
| `MAX_ADVANCE_BOOKING_DAYS` | `7` | Max days ahead to book |
| `EXTENSION_MINUTES` | `5` | Session extension duration |
| `MASTER_RFID_UID` | — | Master RFID for emergency access |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |

---

## 6. Frontend Documentation

### 6.1 Directory Structure

```
frontend/
├── index.html                   # HTML entry point
├── package.json                 # Dependencies & scripts
├── vite.config.js               # Vite configuration (React plugin, proxy to backend)
├── src/
│   ├── main.jsx                 # React entry (BrowserRouter, AuthProvider, Toaster)
│   ├── App.jsx                  # Route definitions & protected route logic
│   ├── index.css                # Global styles (Tailwind imports)
│   ├── contexts/
│   │   └── AuthContext.jsx      # Auth state, login/logout/register, user info
│   ├── services/
│   │   └── api.js               # Axios instance, interceptors, API function exports
│   ├── components/
│   │   ├── Layout.jsx           # App shell (sidebar, top bar, navigation)
│   │   └── UI.jsx               # Reusable UI components (Button, Card, Modal, etc.)
│   └── pages/
│       ├── Login.jsx            # Login page
│       ├── Register.jsx         # Registration page
│       ├── PendingApproval.jsx  # Account pending page
│       ├── Dashboard.jsx        # User home / overview
│       ├── Machines.jsx         # Machine listing with status filters
│       ├── BookingNew.jsx       # 3-step booking wizard
│       ├── MyBookings.jsx       # User's booking history & management
│       ├── ActiveSession.jsx    # Live session with countdown timer
│       ├── SessionHistory.jsx   # Past sessions list
│       ├── Issues.jsx           # Issue reporting & priority rebook
│       ├── Notifications.jsx    # Notification center
│       ├── Profile.jsx          # Profile editing & password change
│       └── admin/
│           ├── AdminDashboard.jsx    # Stats overview + emergency controls
│           ├── UserManagement.jsx    # User CRUD, approve, RFID, roles
│           ├── AllBookings.jsx       # All bookings (admin view)
│           ├── AllSessions.jsx       # All sessions + pause/resume/force-stop
│           ├── AllIssues.jsx         # Issues + verify/resolve/dismiss/rebook
│           ├── MachineManagement.jsx # Machine CRUD + status management
│           └── SystemConfig.jsx      # Key-value config management
```

### 6.2 Pages & Components

#### Public Pages

| Page | Path | Description |
|------|------|-------------|
| **Login** | `/login` | Email/password login with split-panel layout. Redirects to dashboard on success or pending page. |
| **Register** | `/register` | Registration form with name, email, phone, room number, hostel block. Shows feature highlights. |
| **PendingApproval** | `/pending` | Static page shown to pending users. Displays a "waiting for admin" message with sign-out button. |

#### User Pages (Protected)

| Page | Path | Description |
|------|------|-------------|
| **Dashboard** | `/` | Overview: stat cards (machines, bookings, sessions, notifications), quick actions, next booking preview, machine status grid |
| **Machines** | `/machines` | Browse machines with status filter pills. "Book Now" on available machines. Shows online/offline status. |
| **BookingNew** | `/bookings/new` | 3-step wizard: (1) Select machine → (2) Pick date & duration → (3) Choose time slot from grid. Supports `?machine=` pre-selection. |
| **MyBookings** | `/bookings` | Paginated booking list with status filters. Cancel button on confirmed bookings. |
| **ActiveSession** | `/session` | Circular SVG progress ring with live countdown (updates every second). Extend (+5 min) and End buttons. |
| **SessionHistory** | `/sessions` | Read-only list of past sessions with machine, date, duration, extension info. |
| **Issues** | `/issues` | Report new issues (type, machine, description). View own issues. Accept/decline priority rebook offers. |
| **Notifications** | `/notifications` | Notification list with type-specific icons, read/unread states, "mark all read", delete. |
| **Profile** | `/profile` | View/edit profile, statistics (bookings, sessions, no-shows), change password. |

#### Admin/Staff Pages (Protected, role-restricted)

| Page | Path | Access | Description |
|------|------|--------|-------------|
| **AdminDashboard** | `/admin` | Warden, Admin | 8 stat cards, emergency shutdown/reset buttons, quick links to admin pages |
| **UserManagement** | `/admin/users` | Admin only | Full user management: search, filter, approve/reject/block/unblock, RFID assign/revoke, role change, password reset |
| **AllBookings** | `/admin/bookings` | Warden, Admin | All bookings across all users, search & filter by status |
| **AllSessions** | `/admin/sessions` | Warden, Admin | All sessions with pause/resume/force-stop controls for active ones |
| **AllIssues** | `/admin/issues` | Warden, Admin | All issues with verify/resolve/dismiss actions and priority rebook offering |
| **MachineManagement** | `/admin/machines` | Admin only | Full machine CRUD: add/edit/delete machines, update status with maintenance notes |
| **SystemConfig** | `/admin/config` | Admin only | Manage system configuration key-value pairs |

#### Shared Components

| Component | Description |
|-----------|-------------|
| **Layout** | App shell with collapsible sidebar, top bar, notification bell with unread badge, profile/logout links. 30-second polling for unread count. |
| **UI.jsx** | Reusable library: `StatusBadge` (25+ status variants), `Card`, `PageHeader`, `Button` (6 variants, 3 sizes), `Input`, `Select`, `EmptyState`, `Spinner`, `Modal`, `StatCard` |

### 6.3 Routing & Navigation

```
/login              → Login          (public, redirects if logged in)
/register           → Register       (public, redirects if logged in)
/pending            → PendingApproval

/ (Layout wrapper for all protected routes below)
  ├── /             → Dashboard
  ├── /machines     → Machines
  ├── /bookings/new → BookingNew
  ├── /bookings     → MyBookings
  ├── /session      → ActiveSession
  ├── /sessions     → SessionHistory
  ├── /issues       → Issues
  ├── /notifications→ Notifications
  ├── /profile      → Profile
  │
  ├── /admin          → AdminDashboard  (staffOnly: warden + admin)
  ├── /admin/users    → UserManagement  (adminOnly)
  ├── /admin/bookings → AllBookings     (staffOnly)
  ├── /admin/sessions → AllSessions     (staffOnly)
  ├── /admin/issues   → AllIssues       (staffOnly)
  ├── /admin/machines → MachineManagement (adminOnly)
  └── /admin/config   → SystemConfig     (adminOnly)

/*                  → Redirect to /
```

**Route Protection Levels:**
- **Public:** No authentication required
- **Auth:** Requires valid JWT, active account
- **staffOnly:** Requires `warden` or `admin` role
- **adminOnly:** Requires `admin` role

### 6.4 API Service Layer

The frontend uses a centralized Axios instance (`api.js`) with:

- **Base URL:** `/api` (proxied to backend via Vite in dev)
- **Request Interceptor:** Attaches `Authorization: Bearer <token>` from `localStorage`
- **Response Interceptor:** On 401, attempts token refresh using the stored refresh token. On failure, clears storage and redirects to `/login`.

**API modules exported:**
- `authAPI` — 8 methods (register, login, refreshToken, getStatus, getProfile, updateProfile, changePassword, logout)
- `machineAPI` — 6 methods (getAll, getById, create, update, updateStatus, delete)
- `bookingAPI` — 6 methods (create, getMyBookings, getById, getSlots, cancel, getAll)
- `sessionAPI` — 9 methods (start, getActive, extend, end, pause, resume, forceStop, getHistory, getAll)
- `issueAPI` — 9 methods (report, getMyIssues, getAll, verify, resolve, dismiss, offerPriorityRebook, getPendingRebooks, respondToRebook)
- `notificationAPI` — 5 methods (getAll, getUnreadCount, markAllRead, markRead, delete)
- `adminAPI` — 18 methods (users CRUD, config CRUD, emergency controls, analytics)

### 6.5 Authentication Flow

```
Login Form → POST /api/auth/login
       ↓
Server validates credentials, returns { accessToken, refreshToken, user }
       ↓
Tokens stored in localStorage
       ↓
Axios interceptor attaches accessToken to all requests
       ↓
On 401 error → attempt POST /api/auth/refresh-token with refreshToken
       ↓
Success → new tokens stored, original request retried
Failure → localStorage cleared, redirect to /login
```

---

## 7. Hardware Integration (ESP32 + RFID)

### RFID Scan Endpoint

**`POST /api/rfid/scan`** — Called by ESP32 when a card is tapped

**Request:**
```json
{
  "rfidUID": "A1B2C3D4",
  "machineId": "WM-001"
}
```

**Response Actions:**

| Action | When | ESP32 Behavior |
|--------|------|----------------|
| `POWER_ON` | Valid booking found, session started | Activate relay, display welcome message |
| `POWER_OFF` | User taps card during active session | Deactivate relay, display "Session Complete" |
| `DENY` | No booking / wrong machine / inactive account | Error buzzer, display reason |
| `MASTER_ACCESS` | Master RFID scanned | Activate relay for 60 minutes (emergency access) |

**Deny Reasons:**
- `UNKNOWN_RFID` — Card not registered in the system
- `INACTIVE_ACCOUNT` — User account is blocked/pending
- `UNKNOWN_MACHINE` — Machine ID not found
- `MACHINE_UNAVAILABLE` — Machine in maintenance/repair/disabled
- `MACHINE_IN_USE` — Machine occupied by another user
- `NO_BOOKING` — No valid booking for this user on this machine

### Machine Heartbeat

**`POST /api/machines/:machineId/heartbeat`** — Periodic ping from ESP32

- Updates `isOnline: true` and `lastHeartbeat` timestamp
- Cron job marks machines offline if no heartbeat in 10 minutes
- Returns current machine status and active session reference

### Master RFID

A special RFID UID (`MASTER_RFID_UID` env variable) bypasses all checks and grants emergency 60-minute access. Designed for wardens/maintenance staff.

---

## 8. Roles & Permissions

### Role: `user` (Hostel Resident)

| Action | Allowed |
|--------|---------|
| Register & login | ✅ |
| View machines | ✅ |
| Book machine slots | ✅ (requires RFID assigned) |
| Cancel own bookings | ✅ |
| View own bookings | ✅ |
| Start session (via RFID) | ✅ |
| Extend own session | ✅ (one-time +5 min) |
| End own session | ✅ |
| View own session history | ✅ |
| Report issues | ✅ |
| Respond to priority rebook | ✅ |
| View notifications | ✅ |
| Edit own profile | ✅ |

### Role: `warden` (Hostel Warden)

All `user` permissions, plus:

| Action | Allowed |
|--------|---------|
| View admin dashboard | ✅ |
| View all bookings | ✅ |
| View all sessions | ✅ |
| Pause/resume sessions | ✅ |
| Force stop sessions | ✅ |
| View all issues | ✅ |
| Verify/resolve/dismiss issues | ✅ |
| Offer priority rebook | ✅ |
| Update machine status | ✅ |

### Role: `admin` (System Administrator)

All `warden` permissions, plus:

| Action | Allowed |
|--------|---------|
| Approve/reject user registrations | ✅ |
| Block/unblock users | ✅ |
| Assign/revoke RFID cards | ✅ |
| Change user roles | ✅ |
| Reset user passwords | ✅ |
| Create/edit/delete machines | ✅ |
| Manage system configuration | ✅ |
| Emergency shutdown all machines | ✅ |
| Emergency reset (re-enable) | ✅ |
| View analytics (utilization, no-shows, peak usage) | ✅ |

---

## 9. Key Business Logic

### 9.1 Slot Availability & Conflict Detection

When a booking is created, the system checks:
1. No existing `confirmed` or `active` booking overlaps with `[startTime, endTime + buffer]`
2. Buffer between slots: 10 minutes (configurable via `BUFFER_BETWEEN_SLOTS_MINUTES`)
3. The user doesn't already have a booking during the same period

### 9.2 Grace Period & No-Show

- After a booking's `startTime` passes, the user has `GRACE_PERIOD_MINUTES` (default 10) to arrive and scan RFID
- At 5 minutes past (`REMINDER_BEFORE_MINUTES`), a reminder notification is sent
- At 10 minutes past, the booking is auto-cancelled as a no-show
- The user's `noShowCount` is incremented (tracked for analytics)

### 9.3 Session Extension

- Users get **one** +5 minute extension per session (`EXTENSION_MINUTES`)
- Extension is only granted if the next slot on that machine is free
- The booking's `endTime` is updated to match the extended session
- A notification confirms the new end time

### 9.4 Machine Status Cascading

When a machine's status changes to `maintenance`, `repair`, or `disabled`:
1. All upcoming `confirmed` bookings on that machine are auto-cancelled
2. Affected users receive cancellation notifications
3. If there's an active session, it's interrupted
4. The session user receives an interruption notification

### 9.5 Emergency Shutdown

When triggered by admin:
1. All active/paused sessions across all machines are terminated
2. All future confirmed bookings are cancelled
3. All machines set to `disabled`
4. Emergency notifications sent to all affected users

### 9.6 Issue-Triggered Session Pause

When a user reports an issue for a machine with an active session:
1. The session is automatically paused
2. When the issue is resolved, the session resumes
3. The paused duration is added to the session end time (so the user doesn't lose time)

### 9.7 Priority Rebooking

For users whose sessions were interrupted by machine faults:
1. Warden/admin triggers priority rebook from the issue page
2. System scans all available machines for the soonest open 30-minute slot
3. User receives an offer notification
4. Accept → a new priority booking is auto-created
5. Decline → user can book manually
6. Offer expires in 30 minutes if no response

---

## 10. Setup & Installation

### Prerequisites
- **Node.js** v18+ 
- **MongoDB** (local or Atlas)
- **npm** or **yarn**

### Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/lunex
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
GRACE_PERIOD_MINUTES=10
REMINDER_BEFORE_MINUTES=5
BUFFER_BETWEEN_SLOTS_MINUTES=10
MAX_BOOKINGS_PER_DAY=3
MAX_ADVANCE_BOOKING_DAYS=7
EXTENSION_MINUTES=5
MASTER_RFID_UID=MASTER001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

Seed the database:
```bash
npm run seed
```

Start the server:
```bash
npm run dev     # Development (nodemon)
npm start       # Production
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev     # Dev server on http://localhost:5173
npm run build   # Production build
```

The Vite dev server proxies `/api` requests to `http://localhost:5000`.

---

## 11. Seed Data & Test Credentials

Running `npm run seed` creates:

### Users
| Role | Email | Password | RFID UID |
|------|-------|----------|----------|
| Admin | admin@lunex.com | admin123 | ADMIN001 |
| Warden | warden@lunex.com | warden123 | WARDEN01 |
| User | user@lunex.com | user1234 | USER0001 |

### Machines
| Machine ID | Name | Location | ESP32 IP |
|------------|------|----------|----------|
| WM-001 | Washer 1 | Block A - Ground Floor | 192.168.1.101 |
| WM-002 | Washer 2 | Block A - Ground Floor | 192.168.1.102 |
| WM-003 | Washer 3 | Block B - First Floor | 192.168.1.103 |

### System Configs
| Key | Value | Description |
|-----|-------|-------------|
| max_slot_duration_minutes | 60 | Max booking duration |
| buffer_between_slots_minutes | 10 | Buffer between slots |
| extension_minutes | 5 | Extension per session |
| grace_period_minutes | 10 | Arrival grace period |
| reminder_before_minutes | 5 | Reminder after booking start |
| max_bookings_per_day | 3 | Daily booking limit |
| max_advance_booking_days | 7 | Advance booking limit |

---

## API Response Format

All API responses follow a standardized structure:

**Success:**
```json
{
  "success": true,
  "message": "Description of result",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "stack": "..." // Only in development
}
```

---

*Built by LUNEX Team — Smart Laundry & Utility Management for College Hostels*
