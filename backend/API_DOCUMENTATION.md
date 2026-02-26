# LUNEX Backend — API Documentation

> **"Book Smart. Wash Easy. Live Better."**

## Table of Contents
- [Overview](#overview)
- [Getting Started](#getting-started)
- [Test Credentials](#test-credentials)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [System Architecture](#system-architecture)
- [Cron Jobs](#cron-jobs)
- [Edge Cases Handled](#edge-cases-handled)

---

## Overview

LUNEX is a Smart Laundry & Utility Management System backend built with:
- **Runtime:** Node.js
- **Framework:** Express.js v4
- **Database:** MongoDB + Mongoose ODM
- **Authentication:** JWT (Access + Refresh tokens)
- **Validation:** Joi
- **Scheduling:** node-cron
- **Security:** Helmet, CORS, Rate Limiting
- **Logging:** Morgan

---

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB running locally (or MongoDB Atlas URI)

### Installation

```bash
cd backend
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and update values:
```bash
cp .env.example .env
```

### Seed Database

```bash
npm run seed
```

### Bootstrap / Repair Admin (Production-safe)

Use this when production DB does not have a working admin user, or the admin is stuck in `pending`.

```bash
npm run bootstrap:admin -- --email admin@lunex.com --password "YourStrongPassword123!" --name "LUNEX Admin" --phone "9999999999"
```

This command will:
- create the admin if it does not exist
- force role to `admin`
- force account status to `active`
- optionally reset password when `--password` is provided

This creates:
- 1 Admin user
- 1 Warden user
- 1 Test user (with RFID)
- 3 Washing machines
- Default system configs

### Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5000`

---

## Test Credentials

| Role    | Email              | Password    | RFID UID  |
|---------|-------------------|-------------|-----------|
| Admin   | admin@lunex.com   | admin123    | ADMIN001  |
| Warden  | warden@lunex.com  | warden123   | WARDEN01  |
| User    | user@lunex.com    | user1234    | USER0001  |

### Master RFID (Emergency Access)
```
MASTER_RFID_UID: MASTER0001
```

---

## API Endpoints

**Base URL:** `http://localhost:5000/api`

### 🏠 Health

| Method | Endpoint     | Description    | Auth |
|--------|-------------|----------------|------|
| GET    | `/`          | API root info  | No   |
| GET    | `/api/health`| Server health  | No   |

---

### 🔐 Auth (`/api/auth`)

| Method | Endpoint          | Description              | Auth    |
|--------|------------------|--------------------------|---------|
| POST   | `/register`       | Register new user        | No      |
| POST   | `/login`          | Login                    | No      |
| POST   | `/refresh-token`  | Refresh access token     | No      |
| GET    | `/status`         | Check account status     | JWT*    |
| GET    | `/me`             | Get profile              | JWT     |
| PUT    | `/profile`        | Update profile           | JWT     |
| PUT    | `/change-password`| Change password          | JWT     |
| POST   | `/logout`         | Logout                   | JWT     |

*JWT (allows pending users)

#### Register
```json
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "mypassword",
  "roomNumber": "201",
  "hostelBlock": "B"
}
```

#### Login
```json
POST /api/auth/login
{
  "email": "user@lunex.com",
  "password": "user1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "...",
      "name": "Test User",
      "email": "user@lunex.com",
      "role": "user",
      "accountStatus": "active",
      "rfidUID": "USER0001"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

---

### 🔧 Machines (`/api/machines`)

| Method | Endpoint                  | Description             | Auth          |
|--------|--------------------------|-------------------------|---------------|
| GET    | `/`                      | Get all machines         | JWT           |
| GET    | `/:machineId`            | Get machine by ID        | JWT           |
| POST   | `/`                      | Create machine           | Admin         |
| PUT    | `/:machineId`            | Update machine details   | Admin         |
| PUT    | `/:machineId/status`     | Update machine status    | Warden/Admin  |
| DELETE | `/:machineId`            | Delete machine           | Admin         |
| POST   | `/:machineId/heartbeat`  | ESP32 heartbeat          | None (HW)     |

#### Machine Status Values
- `available` — Ready for use
- `in-use` — Currently running a session
- `maintenance` — Under maintenance
- `repair` — Needs repair
- `disabled` — Disabled by admin

---

### 📅 Bookings (`/api/bookings`)

| Method | Endpoint                       | Description           | Auth          |
|--------|-------------------------------|-----------------------|---------------|
| POST   | `/`                           | Create booking         | User          |
| GET    | `/my`                         | Get my bookings        | User          |
| GET    | `/:id`                        | Get booking by ID      | JWT           |
| GET    | `/slots/:machineId/:date`     | Get available slots    | JWT           |
| PUT    | `/:id/cancel`                 | Cancel booking         | User          |
| GET    | `/all`                        | Get all bookings       | Warden/Admin  |

#### Create Booking
```json
POST /api/bookings
Authorization: Bearer <userToken>
{
  "machineId": "WM-001",
  "startTime": "2026-02-24T10:00:00.000Z",
  "durationMinutes": 30
}
```

**Rules Enforced:**
- Max slot duration: 60 minutes
- 10-minute mandatory buffer between slots
- Max 3 bookings per day per user
- Max 7 days advance booking
- RFID must be assigned
- No overlapping bookings

---

### ⚡ Sessions (`/api/sessions`)

| Method | Endpoint            | Description        | Auth          |
|--------|--------------------|--------------------|---------------|
| POST   | `/start`           | Start session       | User          |
| GET    | `/active`          | Get active session  | User          |
| POST   | `/:id/extend`      | Extend +5 min       | User          |
| POST   | `/:id/end`         | End session         | User/Staff    |
| POST   | `/:id/pause`       | Pause session       | Warden/Admin  |
| POST   | `/:id/resume`      | Resume session      | Warden/Admin  |
| POST   | `/:id/force-stop`  | Force stop          | Warden/Admin  |
| GET    | `/history`         | Session history     | User          |
| GET    | `/all`             | All sessions        | Warden/Admin  |

**Extension Rules:**
- One-time only per session
- +5 minutes
- Subject to next slot availability

---

### 🏷️ RFID (`/api/rfid`)

| Method | Endpoint     | Description                    | Auth   |
|--------|-------------|--------------------------------|--------|
| POST   | `/scan`     | RFID scan from ESP32           | None   |
| POST   | `/validate` | Validate RFID before assigning | Admin  |

#### RFID Scan Flow
```json
POST /api/rfid/scan
{
  "rfidUID": "USER0001",
  "machineId": "WM-001"
}
```

**Possible Responses:**

| Action      | Meaning                    |
|-------------|---------------------------|
| POWER_ON    | Valid booking → start      |
| POWER_OFF   | User ending session        |
| DENY        | No booking / invalid       |
| MASTER_ACCESS| Master RFID emergency     |

---

### 🚨 Issues (`/api/issues`)

| Method | Endpoint                            | Description           | Auth          |
|--------|------------------------------------|-----------------------|---------------|
| POST   | `/`                                | Report issue           | User          |
| GET    | `/my`                              | My issues              | User          |
| GET    | `/all`                             | All issues             | Warden/Admin  |
| PUT    | `/:id/verify`                      | Verify issue           | Warden/Admin  |
| PUT    | `/:id/resolve`                     | Resolve issue          | Warden/Admin  |
| PUT    | `/:id/dismiss`                     | Dismiss issue          | Warden/Admin  |
| POST   | `/:id/priority-rebook`             | Offer priority rebook  | Warden/Admin  |
| GET    | `/priority-rebook/pending`         | My pending rebook offers| User         |
| PUT    | `/priority-rebook/:id/respond`     | Accept/decline rebook  | User          |

#### Report Issue
```json
POST /api/issues
Authorization: Bearer <userToken>
{
  "machineId": "WM-001",
  "issueType": "water",
  "description": "No water supply to the machine"
}
```

**Issue Types:** `water`, `power`, `machine-fault`, `other`

---

### 🔔 Notifications (`/api/notifications`)

| Method | Endpoint          | Description           | Auth |
|--------|------------------|-----------------------|------|
| GET    | `/`              | Get my notifications   | JWT  |
| GET    | `/unread-count`  | Get unread count       | JWT  |
| PUT    | `/read-all`      | Mark all as read       | JWT  |
| PUT    | `/:id/read`      | Mark one as read       | JWT  |
| DELETE | `/:id`           | Delete notification    | JWT  |

---

### 👨‍💼 Admin (`/api/admin`)

All admin routes require Admin role.

#### User Management

| Method | Endpoint                 | Description        |
|--------|--------------------------|--------------------|
| GET    | `/users`                 | Get all users      |
| GET    | `/users/pending`         | Pending approvals  |
| PUT    | `/users/approve`         | Approve user       |
| PUT    | `/users/reject`          | Reject user        |
| PUT    | `/users/block`           | Block user         |
| PUT    | `/users/unblock`         | Unblock user       |
| PUT    | `/users/assign-rfid`     | Assign RFID        |
| PUT    | `/users/revoke-rfid`     | Revoke RFID        |
| PUT    | `/users/change-role`     | Change role        |
| PUT    | `/users/reset-password`  | Reset password     |

#### System Configuration

| Method | Endpoint         | Description        |
|--------|------------------|--------------------|
| GET    | `/config`        | Get all configs    |
| PUT    | `/config`        | Set/update config  |
| DELETE | `/config/:key`   | Delete config      |

#### Emergency Controls

| Method | Endpoint               | Description              |
|--------|------------------------|--------------------------|
| POST   | `/emergency/shutdown`  | Shutdown all machines    |
| POST   | `/emergency/reset`     | Re-enable all machines   |

#### Analytics

| Method | Endpoint                         | Description             |
|--------|----------------------------------|-------------------------|
| GET    | `/analytics/dashboard`           | Dashboard overview      |
| GET    | `/analytics/machine-utilization` | Machine usage report    |
| GET    | `/analytics/no-shows`            | No-show statistics      |
| GET    | `/analytics/peak-usage`          | Peak usage hours/days   |

---

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <your_access_token>
```

**Token Lifecycle:**
- Access Token: Valid for 7 days
- Refresh Token: Valid for 30 days
- Use `/api/auth/refresh-token` to get new tokens

---

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description"
}
```

| Status Code | Meaning                |
|-------------|------------------------|
| 400         | Bad Request / Validation Error |
| 401         | Unauthorized / Invalid Token |
| 403         | Forbidden / Wrong Role |
| 404         | Not Found              |
| 409         | Conflict / Duplicate   |
| 429         | Rate Limited           |
| 500         | Internal Server Error  |

---

## System Architecture

```
Mobile App (React Native)
        ↓
  Express.js API Server
        ↓
   MongoDB Database
        ↓
  ESP32 Hardware (HTTP)
        ↓
  Washing Machine (Relay)
```

---

## Cron Jobs

| Job                        | Frequency  | Purpose                           |
|----------------------------|-----------|-----------------------------------|
| No-Show Detection          | Every 1 min| 5-min reminder + 10-min auto-cancel|
| Auto-End Sessions          | Every 1 min| End expired sessions              |
| Session Ending Reminder    | Every 1 min| Warn 5 min before session ends    |
| Expire Priority Rebooks    | Every 5 min| Expire unanswered rebook offers   |
| Machine Heartbeat Check    | Every 5 min| Mark offline machines             |

---

## Edge Cases Handled

| Case                        | Solution                                    |
|-----------------------------|---------------------------------------------|
| Unregistered user           | Pending → Admin approval required           |
| Machine failure before use  | Warden marks repair → Users notified        |
| Machine failure during use  | Session paused → Priority rebook offered    |
| No water/power              | Issue reported → Session paused → Rebook    |
| No-show                     | 5-min warning → 10-min auto-cancel          |
| Network failure             | Master RFID → Offline access                |
| RFID loss/misuse            | Admin revokes → New RFID assigned           |
| Overlapping bookings        | 10-min buffer enforced                      |
| Extension abuse             | One-time only + availability check          |

---

## Postman Collection

Import `LUNEX_API.postman_collection.json` into Postman.

### Quick Start Testing Flow:

1. **Login as Admin** → auto-saves `adminToken`
2. **Login as Warden** → auto-saves `wardenToken`  
3. **Login as User** → auto-saves `userToken`
4. **Create Booking** → auto-saves `bookingId`
5. **RFID Scan** (simulates ESP32 tap) → starts session
6. **Get Active Session** → see countdown
7. **Extend Session** → +5 min
8. **End Session** → completes

### Variables Auto-Set:
- `adminToken`, `wardenToken`, `userToken` — Set on login
- `bookingId` — Set on create booking
- `sessionId` — Set on start session
- `issueId` — Set on report issue

---

## Project Structure

```
backend/
├── .env                              # Environment variables
├── .env.example                      # Env template
├── package.json
├── LUNEX_API.postman_collection.json # Postman collection
├── src/
│   ├── server.js                     # Entry point
│   ├── app.js                        # Express app setup
│   ├── seed.js                       # Database seeder
│   ├── config/
│   │   ├── db.js                     # MongoDB connection
│   │   └── constants.js              # Enums & constants
│   ├── models/
│   │   ├── User.js
│   │   ├── Machine.js
│   │   ├── Booking.js
│   │   ├── Session.js
│   │   ├── Issue.js
│   │   ├── Notification.js
│   │   ├── PriorityRebook.js
│   │   └── SystemConfig.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── bookingController.js
│   │   ├── machineController.js
│   │   ├── sessionController.js
│   │   ├── rfidController.js
│   │   ├── issueController.js
│   │   ├── notificationController.js
│   │   └── adminController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── machineRoutes.js
│   │   ├── sessionRoutes.js
│   │   ├── rfidRoutes.js
│   │   ├── issueRoutes.js
│   │   ├── notificationRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── auth.js                   # JWT verification
│   │   ├── authorize.js              # Role-based access
│   │   ├── errorHandler.js           # Global error handler
│   │   └── validate.js               # Joi validation
│   ├── validators/
│   │   ├── authValidator.js
│   │   ├── bookingValidator.js
│   │   ├── machineValidator.js
│   │   ├── issueValidator.js
│   │   └── adminValidator.js
│   ├── services/
│   │   ├── notificationService.js
│   │   └── bookingService.js
│   ├── utils/
│   │   ├── AppError.js
│   │   ├── asyncHandler.js
│   │   ├── sendResponse.js
│   │   └── dateHelpers.js
│   └── cron/
│       └── cronJobs.js
```

---

## License

ISC — LUNEX Team
