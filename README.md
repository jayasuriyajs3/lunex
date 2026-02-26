# LUNEX

> **Book Smart. Wash Easy. Live Better.**

LUNEX is a full-stack smart laundry management system for hostels with RFID + ESP32 integration.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express + MongoDB
- **IoT:** ESP32 + RC522 RFID reader + relay control

## Project Structure

- `frontend/` — React client
- `backend/` — Express API and business logic
- `PROJECT_DOCUMENTATION.md` — complete architecture and flow documentation
- `backend/API_DOCUMENTATION.md` — backend endpoints and API usage

## Quick Start

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Login Credentials

Use the following credentials to sign in:

### Admin
- **Email:** `jayasuriyajs45@gmail.com`
- **Password:** `123456`

### User
- **Email:** `manojmanojvv123@gmail.com`
- **Password:** `123456`

### Warden
- **Email:** `ram45@gmail.com`
- **Password:** `123456`

## Notes

- Make sure MongoDB is running before starting the backend.
- If you need seeded test data, check `backend/src/seed.js` and run `npm run seed` from `backend/`.
