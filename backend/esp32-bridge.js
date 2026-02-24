/**
 * LUNEX ESP32 Serial Bridge
 * Relays RFID scans from ESP32 (USB) → Backend API
 * 
 * Start with: node esp32-bridge.js
 */

const { SerialPort } = require('serialport');
const axios = require('axios');
require('dotenv').config();

// ===== CONFIG =====
const COM_PORT = process.env.COM_PORT || 'COM3';
const BAUD_RATE = parseInt(process.env.BAUD_RATE) || 115200;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000/api';
const DEVICE_KEY = process.env.DEVICE_KEY || 'esp32_wm002_secret_key_123';
const MACHINE_ID = process.env.MACHINE_ID || 'WM-002';

console.log('🔧 LUNEX ESP32 Bridge Configuration:');
console.log(`   COM Port: ${COM_PORT}`);
console.log(`   Baud Rate: ${BAUD_RATE}`);
console.log(`   Backend URL: ${BACKEND_URL}`);
console.log(`   Machine ID: ${MACHINE_ID}`);
console.log('');

// ===== SERIAL PORT SETUP =====
const serialPort = new SerialPort({ 
  path: COM_PORT, 
  baudRate: BAUD_RATE,
  autoOpen: false 
});

// ===== EVENT: PORT OPENED =====
serialPort.on('open', () => {
  console.log(`✅ Serial port opened on ${COM_PORT}`);
  console.log(`🔌 Listening for ESP32 messages...\n`);
});

// ===== EVENT: DATA RECEIVED =====
serialPort.on('data', async (data) => {
  try {
    const message = data.toString().trim();
    
    // Skip empty or debug messages
    if (!message || message.startsWith('=')) {
      return;
    }
    
    // Parse JSON from ESP32
    let json;
    try {
      json = JSON.parse(message);
    } catch (e) {
      console.log(`⚠️  Non-JSON data: ${message}`);
      return;
    }
    
    // ===== HANDLE RFID SCAN =====
    if (json.type === 'rfid_scan') {
      console.log(`\n📥 RFID Scan from ESP32:`);
      console.log(`   Machine ID: ${json.machineId}`);
      console.log(`   RFID UID: ${json.rfidUID}`);
      console.log(`   Timestamp: ${new Date(json.timestamp).toLocaleString()}`);
      
      try {
        // Call backend /rfid/scan endpoint
        console.log(`   📡 Calling backend API...`);
        const response = await axios.post(
          `${BACKEND_URL}/rfid/scan`,
          {
            rfidUID: json.rfidUID,
            machineId: json.machineId,
            timestamp: new Date().toISOString()
          },
          {
            headers: {
              'x-device-key': DEVICE_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          }
        );
        
        const backendData = response.data.data || {};
        const allowed = backendData.action === 'POWER_ON' || backendData.action === 'MASTER_ACCESS';
        
        console.log(`   ✅ Backend responded:`);
        console.log(`      Action: ${backendData.action}`);
        console.log(`      Allowed: ${allowed}`);
        console.log(`      Reason: ${backendData.reason || 'OK'}`);
        
        // Map backend response to ESP32 format
        const result = {
          type: 'rfid_result',
          allowed: allowed,
          reasonCode: backendData.action || 'UNKNOWN',
          sessionId: backendData.sessionId || null,
          duration: backendData.duration || 0,
          message: backendData.display || backendData.message || (allowed ? 'Access Granted' : 'Access Denied')
        };
        
        const resultJson = JSON.stringify(result);
        serialPort.write(resultJson + '\n');
        console.log(`   📤 Sent to ESP32: ${resultJson}\n`);
        
      } catch (apiError) {
        console.error(`   ❌ Backend error: ${apiError.message}`);
        
        // Send deny on error (safe default)
        const errorResult = {
          type: 'rfid_result',
          allowed: false,
          reasonCode: 'BACKEND_ERROR',
          message: apiError.message
        };
        
        const errorJson = JSON.stringify(errorResult);
        serialPort.write(errorJson + '\n');
        console.log(`   📤 Error response sent: ${errorJson}\n`);
      }
    }
    
    // ===== HANDLE HEARTBEAT =====
    else if (json.type === 'heartbeat') {
      console.log(`\n💓 Heartbeat from ESP32:`);
      console.log(`   Machine ID: ${json.machineId}`);
      console.log(`   Status: ${json.status}`);
      console.log(`   Relay: ${json.relayStatus}`);
      
      try {
        // Call backend heartbeat endpoint
        await axios.post(
          `${BACKEND_URL}/machines/${json.machineId}/heartbeat`,
          {
            status: json.status,
            timestamp: new Date().toISOString()
          },
          {
            headers: {
              'x-device-key': DEVICE_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 3000
          }
        );
        console.log(`   ✅ Heartbeat logged to backend\n`);
      } catch (hbError) {
        console.log(`   ⚠️  Heartbeat error: ${hbError.message}\n`);
      }
    }
    
    // ===== DEBUG MESSAGE =====
    else if (json.type === 'debug') {
      console.log(`🔷 [ESP32] ${json.message}`);
    }
    
    else {
      console.log(`❓ Unknown message type: ${json.type}`);
    }
    
  } catch (error) {
    console.error(`❌ Unexpected error: ${error.message}`);
  }
});

// ===== EVENT: PORT ERROR =====
serialPort.on('error', (err) => {
  console.error(`❌ Serial port error: ${err.message}`);
  process.exit(1);
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down bridge...');
  if (serialPort.isOpen) {
    serialPort.close(() => {
      console.log('✅ Port closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// ===== START BRIDGE =====
serialPort.open((err) => {
  if (err) {
    console.error(`❌ Failed to open ${COM_PORT}: ${err.message}`);
    console.error('   Check Device Manager for correct COM port.');
    process.exit(1);
  }
});
