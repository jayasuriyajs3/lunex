#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>  // Add: npm install ArduinoJson (or use library manager)

LiquidCrystal_I2C lcd(0x27, 16, 2);

// ===== CONFIGURATION =====
#define MACHINE_ID "WM-002"  // CHANGE THIS to your machine ID
#define RELAY_PIN 5
#define BUZZER_PIN 18
#define RFID_RX 17
#define HEARTBEAT_INTERVAL 30000  // 30 seconds

// ===== HARDWARE SERIAL =====
HardwareSerial RFID(2);  // UART2 for RFID

// ===== GLOBAL VARIABLES =====
unsigned long lastHeartbeat = 0;
String lastScannedCard = "";
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_TIME = 2000;  // Prevent duplicate scans within 2 sec

// ===== BUZZER FUNCTIONS =====
void beepShort(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
  }
}

void buzzContinuous(int duration) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(duration);
  digitalWrite(BUZZER_PIN, LOW);
}

void buzzPattern_Allowed() {
  beepShort(2);  // Double beep = allowed
}

void buzzPattern_Denied() {
  buzzContinuous(800);
  delay(200);
  buzzContinuous(800);  // Two short buzzes = denied
}

// ===== LCD HELPER =====
void displayMessage(String line1, String line2 = "") {
  lcd.clear();
  lcd.print(line1);
  if (line2.length() > 0) {
    lcd.setCursor(0, 1);
    lcd.print(line2);
  }
}

// ===== SEND RFID SCAN TO BRIDGE (Serial/USB) =====
void sendRFIDScan(String cardHex) {
  StaticJsonDocument<200> doc;
  doc["type"] = "rfid_scan";
  doc["machineId"] = MACHINE_ID;
  doc["rfidUID"] = cardHex;
  doc["timestamp"] = millis();  // Use millis() or add NTP time sync later
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println(jsonString);  // Send to bridge via USB
  Serial.flush();
}

// ===== WAIT FOR BRIDGE RESPONSE =====
bool waitForBridgeResponse(String& response, unsigned long timeout = 5000) {
  unsigned long startTime = millis();
  
  while (millis() - startTime < timeout) {
    if (Serial.available()) {
      response = Serial.readStringUntil('\n');
      response.trim();
      return true;
    }
    delay(50);
  }
  
  return false;  // Timeout
}

// ===== PARSE BRIDGE RESPONSE & ACT =====
void handleScanResponse(String rfidUID, String response) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, response);
  
  if (error) {
    displayMessage("❌ Json Error", "Check bridge");
    buzzPattern_Denied();
    return;
  }
  
  bool allowed = doc["allowed"] | false;
  String reasonCode = doc["reasonCode"] | "UNKNOWN";
  String sessionId = doc["sessionId"] | "";
  
  if (allowed) {
    // ===== ACCESS GRANTED =====
    displayMessage("✅ Access OK", reasonCode);
    buzzPattern_Allowed();
    delay(1000);
    
    // Activate relay for 30 seconds (same as original code)
    digitalWrite(RELAY_PIN, LOW);   // RELAY ON (motor starts)
    
    for (int t = 30; t > 0; t--) {
      displayMessage("Running", String(t) + "s left");
      delay(1000);
    }
    
    digitalWrite(RELAY_PIN, HIGH);  // RELAY OFF (motor stops)
    displayMessage("✅ Complete", "");
    delay(1000);
    
  } else {
    // ===== ACCESS DENIED =====
    displayMessage("❌ DENIED", reasonCode);
    buzzPattern_Denied();
    delay(2000);
  }
  
  // Show ready state
  displayMessage("Ready", "Tap card...");
}

// ===== FALLBACK: LOCAL MODE (if bridge/backend down) =====
void fallbackOfflineMode(String rfidUID) {
  // Default: DENY everything if backend is unreachable
  // (safer than allowing unknown cards)
  displayMessage("⚠️  No Connection", "Access Denied");
  buzzPattern_Denied();
  delay(2000);
  displayMessage("Ready", "Tap card...");
  
  // Optional: Enable one master card for emergency access
  // if (rfidUID == "MASTER_CARD_HEX") {
  //   handleScanResponse(rfidUID, "{\"allowed\":true,\"reasonCode\":\"MASTER_CARD\"}");
  // }
}

// ===== SEND HEARTBEAT TO BRIDGE =====
void sendHeartbeat() {
  StaticJsonDocument<200> doc;
  doc["type"] = "heartbeat";
  doc["machineId"] = MACHINE_ID;
  doc["status"] = "online";
  doc["relayStatus"] = digitalWrite(RELAY_PIN) == LOW ? "ON" : "OFF";
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println(jsonString);
  Serial.flush();
}

// ===== SETUP =====
void setup() {
  // USB Serial (for bridge communication)
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== LUNEX ESP32 RFID Module ===");
  Serial.print("Machine ID: ");
  Serial.println(MACHINE_ID);
  
  // RFID Serial (UART2 at 9600 baud)
  RFID.begin(9600, SERIAL_8N1, RFID_RX, -1);
  
  // LCD Setup
  lcd.init();
  lcd.backlight();
  
  // GPIO Setup
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  digitalWrite(RELAY_PIN, HIGH);   // Relay OFF initially
  digitalWrite(BUZZER_PIN, LOW);   // Buzzer OFF
  
  displayMessage("LUNEX", "Initializing...");
  beepShort(1);
  
  delay(2000);
  displayMessage("Ready", "Tap card...");
  
  lastHeartbeat = millis();
}

// ===== MAIN LOOP =====
void loop() {
  
  // ===== HEARTBEAT (every 30 seconds) =====
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // ===== RFID SCAN =====
  if (!RFID.available()) {
    delay(50);
    return;
  }
  
  // Debounce: ignore if same card scanned within 2 seconds
  if (millis() - lastScanTime < DEBOUNCE_TIME && lastScannedCard.length() > 0) {
    RFID.readStringUntil('\r');  // Clear buffer
    return;
  }
  
  displayMessage("Scanning...", "");
  
  String cardHex = "";
  unsigned long startTime = millis();
  
  // Read for 1 second (same as original)
  while (millis() - startTime < 1000) {
    if (RFID.available()) {
      char c = RFID.read();
      if (isxdigit(c)) {
        cardHex += c;
      }
    }
  }
  
  cardHex.toUpperCase();
  
  Serial.print("🔷 Scanned: ");
  Serial.println(cardHex);
  
  // Validate card format
  if (cardHex.length() < 10) {
    displayMessage("Invalid card", "Try again");
    buzzPattern_Denied();
    delay(1000);
    displayMessage("Ready", "Tap card...");
    return;
  }
  
  lastScannedCard = cardHex;
  lastScanTime = millis();
  
  // ===== SEND TO BRIDGE & WAIT FOR RESPONSE =====
  sendRFIDScan(cardHex);
  
  displayMessage("Validating...", "");
  delay(500);
  
  String bridgeResponse = "";
  if (waitForBridgeResponse(bridgeResponse, 5000)) {
    // Got response from bridge
    Serial.print("📨 Response: ");
    Serial.println(bridgeResponse);
    handleScanResponse(cardHex, bridgeResponse);
  } else {
    // No response from bridge within 5 seconds
    Serial.println("❌ Bridge timeout - offline mode");
    fallbackOfflineMode(cardHex);
  }
}
