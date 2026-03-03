#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>

// ===== LCD =====
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ===== PINS =====
#define RELAY_PIN 5
#define BUZZER_PIN 18
#define RFID_RX 17

HardwareSerial RFID(2);

// ===== WIFI =====
const char* ssid = "iPhone";
const char* password = "harshad1410";

// ===== BACKEND =====
String serverURL = "http://10.207.114.145:5000/api/rfid/scan";
String MACHINE_ID = "WM-001";

// ===== MACHINE STATE =====
bool machineRunning = false;

// ===== BUZZER =====
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

// ===== WIFI CONNECT =====
void connectWiFi() {

  lcd.clear();
  lcd.print("Connecting WiFi");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  lcd.clear();
  lcd.print("WiFi Connected");
  delay(1000);
}

// ===== SEND RFID =====
String sendRFID(String uid) {

  if (WiFi.status() != WL_CONNECTED) return "NO_WIFI";

  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");

  String body = "{\"rfidUID\":\"" + uid + "\",\"machineId\":\"" + MACHINE_ID + "\"}";
  int code = http.POST(body);

  String response = http.getString();
  http.end();

  // 🔥 Normalize response (VERY IMPORTANT)
  response.trim();
  response.toUpperCase();

  Serial.print("SERVER RESPONSE: ");
  Serial.println(response);

  return response;
}

// ===== SETUP =====
void setup() {

  Serial.begin(115200);

  Wire.begin();
  lcd.init();
  lcd.backlight();

  RFID.begin(9600, SERIAL_8N1, RFID_RX, -1);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(RELAY_PIN, HIGH); // OFF initially
  digitalWrite(BUZZER_PIN, LOW);

  connectWiFi();

  lcd.clear();
  lcd.print("Tap Card...");
}

// ===== LOOP =====
void loop() {

  // Auto reconnect WiFi
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!RFID.available()) return;

  lcd.clear();
  lcd.print("Scanning...");

  String cardHex = "";
  unsigned long startTime = millis();

  while (millis() - startTime < 1000) {
    if (RFID.available()) {
      char c = RFID.read();
      if (isxdigit(c)) cardHex += c;
    }
  }

  cardHex.toUpperCase();

  if (cardHex.length() < 8) {
    lcd.clear();
    lcd.print("Invalid Scan");
    delay(1500);
    lcd.clear();
    lcd.print("Tap Card...");
    return;
  }

  lcd.clear();
  lcd.print("Verifying...");

  String response = sendRFID(cardHex);

  // ===== POWER ON =====
  if (response.indexOf("POWER_ON") >= 0) {

    machineRunning = true;

    lcd.clear();
    lcd.print("Access Granted");

    digitalWrite(RELAY_PIN, LOW); // ON
    beepShort(2);

    delay(2000);
  }

  // ===== POWER OFF =====
  else if (response.indexOf("POWER_OFF") >= 0) {

    machineRunning = false;

    lcd.clear();
    lcd.print("Session End");

    digitalWrite(RELAY_PIN, HIGH); // OFF
    beepShort(1);

    delay(2000);
  }

  // ===== SLOT NOT STARTED =====
  else if (response.indexOf("TOO_EARLY") >= 0 ||
           response.indexOf("NOT_STARTED") >= 0) {

    lcd.clear();
    lcd.print("Wait Slot Time");

    buzzContinuous(1500);
    delay(2000);
  }

  // ===== SLOT EXPIRED =====
  else if (response.indexOf("EXPIRED") >= 0) {

    lcd.clear();
    lcd.print("Slot Expired");

    buzzContinuous(2000);
    delay(2000);
  }

  // ===== NO WIFI =====
  else if (response.indexOf("NO_WIFI") >= 0) {

    lcd.clear();
    lcd.print("WiFi Error");

    buzzContinuous(2000);
    connectWiFi();
  }

  // ===== ACCESS DENIED =====
  else {

    lcd.clear();
    lcd.print("Access Denied");

    buzzContinuous(3000);

    // DO NOT stop machine if already running
    if (!machineRunning) {
      digitalWrite(RELAY_PIN, HIGH);
    }

    delay(2000);
  }

  lcd.clear();
  lcd.print("Tap Card...");
}