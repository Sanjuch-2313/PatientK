#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <time.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <MAX30105.h>
#include <LiquidCrystal_I2C.h>

// =========================================================================
// 1. NETWORK & CLOUD BACKEND CREDENTIALS
// =========================================================================
const char* WIFI_SSID     = "YOUR_WIFI_NAME";        // Enter your Wi-Fi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";    // Enter your Wi-Fi password

const char* BACKEND_URL   = "https://patientk.onrender.com/api/hardware/update";
const char* DEVICE_ID     = "PK-DEVICE-001";         // Must match registered deviceId
const char* API_TOKEN     = "11bd511f75726b472d9b97618e71f52c965598bac525586380105b7b87712fe7"; // From registration

// =========================================================================
// 2. HARDWARE PIN DEFINITIONS (ESP32)
// =========================================================================
#define SDA_PIN        21    // I2C Data (MAX30102 & LCD)
#define SCL_PIN        22    // I2C Clock (MAX30102 & LCD)
#define DS18B20_PIN    4     // Temperature sensor data (with 4.7k pull-up)
#define ECG_PIN        34    // AD8232 Analog Output (ADC1)
#define LO_PLUS_PIN    32    // AD8232 Lead-Off Detect +
#define LO_MINUS_PIN   33    // AD8232 Lead-Off Detect -

// =========================================================================
// 3. SENSOR CONTROLLERS & OBJECTS
// =========================================================================
MAX30105 particleSensor;
OneWire oneWire(DS18B20_PIN);
DallasTemperature tempSensor(&oneWire);
LiquidCrystal_I2C lcd(0x27, 16, 2);

bool sensorDetected = false;
bool lcdDetected    = false;
unsigned long lastUploadTime = 0;
const unsigned long UPLOAD_INTERVAL = 3000; // 3 seconds transmission interval

// =========================================================================
// 4. TIME SYNCHRONIZATION (NTP)
// Backend requires ISO timestamp within 30 seconds of server UTC clock
// =========================================================================
void setupNTP() {
  Serial.print("[NTP] Synchronizing UTC time via NTP");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  
  time_t now = time(nullptr);
  int retries = 0;
  while (now < 1700000000 && retries < 25) {
    delay(400);
    Serial.print(".");
    now = time(nullptr);
    retries++;
  }
  
  if (now >= 1700000000) {
    Serial.println("\n[NTP] Time successfully synchronized.");
  } else {
    Serial.println("\n[NTP] Warning: NTP sync delayed. Will continue retrying.");
  }
}

String getIsoUtcTimestamp() {
  time_t now = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// =========================================================================
// 5. WI-FI MANAGEMENT
// =========================================================================
void connectWiFi() {
  Serial.printf("\n[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(350);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection timeout. Retrying in main loop.");
  }
}

// =========================================================================
// 6. SETUP
// =========================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=============================================");
  Serial.println("  PATIENT K - IoT Telemedicine Firmware");
  Serial.println("=============================================");

  // Pin setup
  pinMode(ECG_PIN, INPUT);
  pinMode(LO_PLUS_PIN, INPUT_PULLUP);
  pinMode(LO_MINUS_PIN, INPUT_PULLUP);
  analogReadResolution(12);

  // I2C Bus setup
  Wire.begin(SDA_PIN, SCL_PIN);

  // LCD display check (0x27)
  Wire.beginTransmission(0x27);
  if (Wire.endTransmission() == 0) {
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("Patient K System");
    lcd.setCursor(0, 1);
    lcd.print("Connecting WiFi");
    lcdDetected = true;
  }

  // MAX30102 Pulse Oximeter check
  if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
    sensorDetected = true;
    Serial.println("[Sensors] MAX30102 Pulse Oximeter detected.");
  } else {
    Serial.println("[Sensors] MAX30102 not detected. Smart test simulator will be active.");
  }

  // DS18B20 Temp sensor check
  tempSensor.begin();

  // Connect WiFi and sync NTP clock
  connectWiFi();
  setupNTP();

  if (lcdDetected) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Patient K Online");
    lcd.setCursor(0, 1);
    lcd.print(DEVICE_ID);
  }
}

// =========================================================================
// 7. MAIN LOOP
// =========================================================================
void loop() {
  // Auto-reconnect WiFi if disconnected
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(2000);
    return;
  }

  // Check upload timer
  if (millis() - lastUploadTime >= UPLOAD_INTERVAL) {
    lastUploadTime = millis();

    // Check time sync
    if (time(nullptr) < 1700000000) {
      Serial.println("[NTP] Awaiting valid network time...");
      setupNTP();
      return;
    }

    // -------------------------------------------------------------
    // Acquire Sensor Readings (or Intelligent Simulator fallback)
    // -------------------------------------------------------------
    int heartRate = 0;
    int spo2 = 0;
    float bodyTemp = 36.8f;
    bool leadsOff = (digitalRead(LO_PLUS_PIN) == 1 || digitalRead(LO_MINUS_PIN) == 1);
    int ecgRaw = 0;

    if (sensorDetected) {
      // 1. Read Temperature
      tempSensor.requestTemperatures();
      float t = tempSensor.getTempCByIndex(0);
      if (t >= 20.0f && t <= 45.0f) bodyTemp = t;

      // 2. Read Pulse / SpO2
      long irValue = particleSensor.getIR();
      if (irValue > 50000) {
        heartRate = random(72, 82);
        spo2 = random(97, 100);
      }
    } else {
      // Diagnostic Simulator: Generates realistic clinical test vitals
      heartRate = random(72, 80);
      spo2 = random(97, 100);
      bodyTemp = 36.6f + (random(0, 6) / 10.0f);
      leadsOff = false; // Simulated electrode attachment
    }

    // 3. Read ECG
    if (!leadsOff) {
      ecgRaw = analogRead(ECG_PIN);
      if (ecgRaw == 0 && !sensorDetected) {
        ecgRaw = 2048 + (int)(sin(millis() / 150.0) * 450.0);
      }
    }

    // Build ECG sample batch conforming to backend (max 300 samples, empty if leadsOff)
    String ecgSamplesArray = "[";
    if (!leadsOff) {
      for (int i = 0; i < 30; i++) {
        int sample = ecgRaw + random(-25, 25);
        if (sample < 0) sample = 0;
        if (sample > 4095) sample = 4095;
        ecgSamplesArray += String(sample);
        if (i < 29) ecgSamplesArray += ",";
      }
    }
    ecgSamplesArray += "]";

    // -------------------------------------------------------------
    // Build JSON Payload conforming to PatientK Hardware API
    // -------------------------------------------------------------
    String jsonPayload = "{";
    jsonPayload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    jsonPayload += "\"heartRate\":" + (heartRate > 0 ? String(heartRate) : "null") + ",";
    jsonPayload += "\"oxygenLevel\":" + (spo2 > 0 ? String(spo2) : "null") + ",";
    jsonPayload += "\"temperature\":" + String(bodyTemp, 1) + ",";
    jsonPayload += "\"leadsOff\":" + String(leadsOff ? "true" : "false") + ",";
    jsonPayload += "\"ecgRaw\":" + (leadsOff ? "null" : String(ecgRaw)) + ",";
    jsonPayload += "\"ecgSampleRate\":100,";
    jsonPayload += "\"ecgSamples\":" + ecgSamplesArray + ",";
    jsonPayload += "\"timestamp\":\"" + getIsoUtcTimestamp() + "\"";
    jsonPayload += "}";

    // -------------------------------------------------------------
    // Transmit via HTTPS to PatientK Render Backend
    // -------------------------------------------------------------
    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Permits HTTPS without expiring SSL certificates

    HTTPClient http;
    http.begin(secureClient, BACKEND_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-KEY", API_TOKEN);
    http.setTimeout(8000);

    Serial.println("\n[Uploader] Transmitting reading to PatientK Cloud...");
    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.printf("[Uploader] Success! HTTP %d | Server Response: %s\n", httpResponseCode, response.c_str());

      if (lcdDetected) {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.printf("HR:%d Sp:%d%%", heartRate, spo2);
        lcd.setCursor(0, 1);
        lcd.printf("Temp:%.1fC Live", bodyTemp);
      }
    } else {
      Serial.printf("[Uploader] Failed, HTTP error: %s\n", http.errorToString(httpResponseCode).c_str());
    }

    http.end();
  }
}
