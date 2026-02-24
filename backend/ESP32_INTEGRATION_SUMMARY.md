# 🎯 LUNEX ESP32 Integration — Complete Package

## ✅ What Has Been Delivered

Your ESP32 hardware code has been **fully integrated** with LUNEX backend. Here's what you have:

| Component | File | Purpose |
|-----------|------|---------|
| **ESP32 Firmware** | `ESP32_LUNEX_INTEGRATED.ino` | Updated ESP32 code with serial JSON communication |
| **Serial Bridge** | `esp32-bridge.js` | Node.js app to relay RFID scans from hardware to backend |
| **Bridge Config** | `.env.bridge` | Configuration for COM port, API key, backend URL |
| **Setup Guide** | `ESP32_INTEGRATION_GUIDE.md` | Step-by-step integration instructions |
| **Package Updates** | `package.json` | Added `serialport` & `axios` dependencies |
| **Validator Fix** | Already applied | Allow empty ESP32 IP for USB cable setups |

---

## 🔄 Integration Flow

```
RFID Card Tapped
    ↓
ESP32 reads card UID from EM18 module (GPIO 17)
    ↓
ESP32 sends JSON via Serial (USB):
{
  "type": "rfid_scan",
  "machineId": "WM-002",
  "rfidUID": "A1B2C3D4",
  "timestamp": 12345678
}
    ↓
Bridge app (Node.js) receives on COM3
    ↓
Bridge calls: POST http://localhost:5000/api/rfid/scan
with headers: x-device-key: esp32_WM002_abc123...
    ↓
Backend validates:
  ✓ RFID mapped to user
  ✓ User account active
  ✓ Machine available
  ✓ User has valid booking
    ↓
Backend returns:
{
  "action": "POWER_ON",
  "duration": 30,
  "sessionId": "ses_123",
  "message": "Welcome John"
}
    ↓
Bridge sends response to ESP32 via Serial:
{
  "type": "rfid_result",
  "allowed": true,
  "reasonCode": "POWER_ON",
  "duration": 30,
  "message": "Welcome John"
}
    ↓
ESP32 receives & acts:
  ✓ Double beep (allowed tone)
  ✓ Relay ON (GPIO 5) for 30 seconds
  ✓ LCD shows "Welcome John"
  ✓ Countdown timer on LCD
  ✓ Relay OFF after 30 sec
    ↓
Session logged in backend + visible in Admin Dashboard
```

---

## 🚀 Quick Start (5 Minutes)

### 1️⃣ **Register Machine in Admin UI**
```
Admin → Machines → Add Machine
├─ Machine ID: WM-002
├─ Name: Washer 2
├─ Location: Block A - Ground Floor
├─ ESP32 IP: (leave empty)
└─ Relay Pin: 5

⭐ COPY the Device Key shown (e.g., esp32_WM002_xyz123abc...)
```

### 2️⃣ **Upload ESP32 Firmware**
```
1. Arduino IDE → Open `ESP32_LUNEX_INTEGRATED.ino`
2. Install library: ArduinoJson (via Library Manager)
3. Select Board: ESP32 Dev Module
4. Select Port: COM3 (or your USB port)
5. Click Upload
```

### 3️⃣ **Configure & Start Bridge**
```bash
# Install dependencies (one-time)
cd d:\lunex\backend
npm install serialport axios dotenv

# Edit .env.bridge
COM_PORT=COM3
DEVICE_KEY=esp32_WM002_xyz123abc...  # ← PASTE FROM STEP 1

# Start bridge in new terminal
node esp32-bridge.js
```

### 4️⃣ **Test**
- Start backend: `npm start`
- Tap RFID card → Watch logs → Relay activates
- ✅ Done!

---

## 📋 Integration Checklist

- [ ] Machine registered (Admin → Machines → Create)
- [ ] Device Key copied from machine creation response
- [ ] `.env.bridge` configured with Device Key
- [ ] ArduinoJson library installed in Arduino IDE
- [ ] ESP32 firmware uploaded
- [ ] `npm install serialport axios dotenv` completed
- [ ] Backend running: `npm start`
- [ ] Bridge running: `node esp32-bridge.js`
- [ ] RFID card tapped → Check terminal logs
- [ ] Relay activates ✓ Buzzer sounds ✓ LCD displays ✓

---

## 🔌 Key Changes From Original Code

### ✅ What's Preserved
- Relay control on GPIO 5
- Buzzer patterns on GPIO 18
- 16x2 LCD I2C display
- RFID reading from GPIO 17 (EM18 module)
- 30-second session timing
- Hardware failure safety (relay off on power loss)

### ✨ What's Added
- JSON serial communication to backend
- Device authentication (API key per machine)
- Real-time validation against backend
- Heartbeat every 30 seconds
- Debounce protection (no duplicate scans <2 sec)
- Offline/fallback mode (safe deny if backend down)
- Improved LCD messaging
- Session logging on backend

### ❌ What's Removed
- Hardcoded card authorization (`AUTHORIZED_HEX`)
- Local-only validation
- No backend communication

---

## 🛠️ Files Reference

### **ESP32_LUNEX_INTEGRATED.ino** (Updated Firmware)
```cpp
// Key additions:
- JSON library: #include <ArduinoJson.h>
- Send RFID scan as JSON over Serial
- Wait for bridge response (5 sec timeout)
- Parse response: allowed true/false
- Activate relay based on response
- Send heartbeat every 30 seconds
- Fallback offline mode (deny if no response)
```

### **esp32-bridge.js** (Serial Bridge)
```javascript
// Key features:
- Opens COM port (9600/115200 baud configurable)
- Listens for JSON from ESP32
- Validates device key header
- Calls backend /rfid/scan API
- Maps backend response to ESP32 format
- Sends decision back to ESP32
- Logs all activity
```

### **.env.bridge** (Configuration)
```env
COM_PORT=COM3              # Windows COM port
BAUD_RATE=115200         # Must match ESP32: Serial.begin(115200)
BACKEND_URL=http://localhost:5000/api
MACHINE_ID=WM-002
DEVICE_KEY=esp32_WM002_  # Get from Admin after machine creation
```

---

## 📊 Response Codes Reference

| Backend Action | Allowed | ESP32 Behavior |
|----------------|---------|----------------|
| `POWER_ON` | ✅ YES | Relay ON for duration, green LED, success beep |
| `POWER_OFF` | ✅ YES | Relay OFF, green LED, success beep |
| `MASTER_ACCESS` | ✅ YES | Relay ON for 60 sec (emergency mode) |
| `DENY` | ❌ NO | Relay OFF, red LED, error buzzer |
| `UNKNOWN_RFID` | ❌ NO | Card not mapped to user |
| `NO_BOOKING` | ❌ NO | User has no valid booking |
| `MACHINE_IN_USE` | ❌ NO | Another user using machine |
| `MACHINE_UNAVAILABLE` | ❌ NO | Machine in maintenance/repair |
| `BACKEND_ERROR` | ❌ NO | Bridge/backend unreachable (timeout) |

---

## 🔐 Security

✅ Each machine has unique API key (not shared)  
✅ Keys validated on every request  
✅ All RFID scans logged with timestamp + decision  
✅ Offline mode defaults to DENY (safe)  
✅ No hardcoded credentials in code  
✅ Device key rotatable via admin UI  

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Failed to open COM3" | Wrong COM port | Check Device Manager, update `.env.bridge` |
| "esp32Ip is not allowed to be empty" | ~~Old validator~~ | ✅ Fixed - validator updated |
| Bridge timeout / offline mode | Backend down | `npm start` backend first |
| "No response from bridge" | Bridge not running | `node esp32-bridge.js` in new terminal |
| Card denied but should allow | No booking for user | Create booking in Admin → Bookings |
| Relay stays ON forever | Hardware issue or GPIO error | Verify GPIO 5 wiring + relay module |

---

## 📚 Next Steps

1. **Transfer Device Key to Bridge**
   - Create machine in Admin → Copy key → Paste in `.env.bridge`

2. **Upload & Test**
   - Upload firmware → Run bridge → Tap card

3. **Monitor Session**
   - Admin → Activity/Logs → See RFID scans & decisions
   - Check dashboards for machine status

4. **Scale Up**
   - Register more machines (each gets unique API key)
   - Run bridge for each machine OR use multi-port bridge

---

## 📞 Support

All logs printed to terminal to help debug:

```bash
# Bridge logs show:
✅ Serial port opened
🔌 Listening for messages
📥 RFID scan received
📡 Backend API called
✅ Backend responded
📤 Sent to ESP32
```

Check logs first if something doesn't work!

---

## ✨ You're All Set!

Your ESP32 is now **fully integrated** with LUNEX backend.  
Follow the **Quick Start** section above to go live.

**Questions?** Check `ESP32_INTEGRATION_GUIDE.md` for detailed instructions.
