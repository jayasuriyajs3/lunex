# LUNEX ESP32 Hardware Integration Guide

## ✅ What's Integrated

Your existing hardware code has been **safely integrated** to work with the LUNEX backend:

- ✅ RFID scanning (RC522/EM18)
- ✅ Relay control (GPIO 5)
- ✅ Buzzer & LCD display
- ✅ JSON serial communication
- ✅ Backend validation
- ✅ Heartbeat/device health checks
- ✅ Fallback offline mode (denies if backend unreachable)

---

## 📋 Setup Steps

### Step 1: Register Machine via Admin UI

1. Go to **Admin Dashboard → Machines**
2. Click **Add New Machine**
3. Fill in:
   - **Machine ID**: `WM-002` (or your ID)
   - **Name**: `Washer 2`
   - **Location**: `Block A - Ground Floor`
   - **ESP32 IP**: *(leave empty for USB)*
   - **Relay Pin**: `5`
4. Click **Create**
5. **⭐ IMPORTANT: Copy the Device Key shown** (looks like `esp32_WM002_abc123...`)

### Step 2: Upload ESP32 Firmware

1. Install Arduino IDE (or VS Code + PlatformIO)
2. Install Library: **ArduinoJson** (Sketch → Include Library → Manage Libraries → search "ArduinoJson" by Benoit Blanchon)
3. Open `ESP32_LUNEX_INTEGRATED.ino`
4. Change line 7 if needed:
   ```cpp
   #define MACHINE_ID "WM-002"  // CHANGE TO YOUR MACHINE ID
   ```
5. Select Board: **ESP32 Dev Module**
6. Select Port: **COM3** (or your USB port)
7. Click **Upload**
8. Monitor output (Tools → Serial Monitor) at **115200 baud**

### Step 3: Install Bridge Dependencies

```bash
cd d:\lunex\backend

npm install serialport axios dotenv
```

### Step 4: Configure Bridge

1. Rename `.env.bridge` to `.env` (or keep `.env.bridge` if you already use `.env`)
2. Edit `.env.bridge` and fill:
   ```env
   COM_PORT=COM3
   BAUD_RATE=115200
   BACKEND_URL=http://localhost:5000/api
   MACHINE_ID=WM-002
   DEVICE_KEY=esp32_WM002_abc123def456  # ← PASTE FROM STEP 1
   ```
3. **Save the file**

### Step 5: Start the Bridge

```bash
cd d:\lunex\backend

# Make sure backend is running:
npm start

# In a NEW terminal, start the bridge:
node esp32-bridge.js --require dotenv/config
```

You should see:
```
✅ Serial port opened on COM3
🔌 Listening for ESP32 messages...
```

### Step 6: Test the Integration

1. **Tap a registered card** on the RFID scanner
2. **Watch the terminal logs:**
   ```
   📥 RFID Scan from ESP32:
      Machine ID: WM-002
      RFID UID: A1B2C3D4
      Timestamp: 2/24/2026, 2:30:00 PM
      📡 Calling backend API...
      ✅ Backend responded:
         Allowed: true
         Reason: BOOKING_VALID
      📤 Sent to ESP32: {...}
   ```
3. **ESP32 should respond:**
   - ✅ **If allowed**: Double beep + relay ON for 30 seconds + LCD shows "Access OK"
   - ❌ **If denied**: Two short buzzes + LCD shows "DENIED"

---

## 🔌 Port Mapping (Windows)

To find your COM port:
1. Connect ESP32 via USB
2. Open **Device Manager**
3. Look under **Ports (COM & LPT)**
4. You'll see something like `USB-SERIAL CH340 (COM3)`
5. Use that COM number in `.env.bridge`

---

## 📊 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                          ESP32                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   RFID   │→ │ Relay    │  │Buzzer    │  │   LCD    │   │
│  │ Scanner  │  │ (GPIO 5) │  │(GPIO 18) │  │(I2C)     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│        ↓                                                     │
│    Sends JSON over Serial (USB)                            │
└─────────────────────────────────────────────────────────────┘
         ↓ USB Cable ↓
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Bridge (PC)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Reads JSON → Validates → Calls Backend API         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓ HTTP ↓
┌─────────────────────────────────────────────────────────────┐
│                   LUNEX Backend API                         │
│  POST /api/rfid/scan                                        │
│  ├─ Verify device (device key)                             │
│  ├─ Find RFID → User mapping                               │
│  ├─ Check active booking/session                           │
│  ├─ Check machine status                                   │
│  └─ Return: allowed (true/false) + reason code             │
└─────────────────────────────────────────────────────────────┘
         ↓ JSON Response ↓
┌─────────────────────────────────────────────────────────────┐
│                   Node.js Bridge (PC)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Sends response back to ESP32 over Serial            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓ USB Cable ↓
┌─────────────────────────────────────────────────────────────┐
│                          ESP32                              │
│  Activates Relay (30 sec) OR Buzzer/LCD                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Troubleshooting

### ❌ "Failed to open COM3"
- Check Device Manager for correct COM port
- Update `.env.bridge` with correct `COM_PORT`
- Try unplugging and replugging USB cable

### ❌ "Bridge timeout - offline mode" (ESP32 LCD message)
- Backend may be down: check `npm start` status
- Bridge not running: start with `node esp32-bridge.js`
- Network connection disabled
- Device key mismatch in `.env.bridge`

### ❌ "Access Denied" for valid booking
- RFID UID not mapped to user in backend database
- No active booking for user + machine + time slot
- Machine status is not "AVAILABLE"
- Check logs in Admin → Activity/Logs

### ✅ No response from bridge
- Check `.env.bridge` has correct `DEVICE_KEY`
- Verify `BACKEND_URL` is correct
- Check backend logs for `/rfid/scan` errors
- Restart both backend and bridge

---

## 📝 Configuration Files Reference

| File | Purpose |
|------|---------|
| `ESP32_LUNEX_INTEGRATED.ino` | ESP32 firmware (upload to board) |
| `esp32-bridge.js` | Node.js serial bridge (run on PC) |
| `.env.bridge` | Bridge configuration (COM port, API key) |

---

## 🔐 Security Notes

- ✅ Device keys are per-machine (not shared)
- ✅ Keys are transmitted to backend with each request
- ✅ Backend validates key before processing
- ✅ Offline mode defaults to DENY (safe)
- ✅ All RFID scans are logged with timestamp + result

---

## 🚀 Next Steps (Optional)

1. **RFID Card Mapping**: Admin adds RFID cards to user profiles
2. **Session Logging**: Frontend displays RFID scan history/logs
3. **Alerts**: Notify admin of unauthorized access attempts
4. **Device Health Dashboard**: Show machine heartbeat status
5. **QR Code Integration**: Combine RFID + QR codes for bookings

---

## 📞 Quick Start Checklist

- [ ] Machine registered in Admin UI (get Device Key)
- [ ] ESP32 firmware uploaded
- [ ] `.env.bridge` configured with Device Key
- [ ] `serialport` + `axios` installed (`npm install`)
- [ ] Backend running (`npm start`)
- [ ] Bridge running (`node esp32-bridge.js`)
- [ ] RFID card tapped → Check terminal logs
- [ ] Relay activates + LCD shows message
- [ ] All working → Go live!

---

**Questions? Check terminal logs for exact error messages.**
