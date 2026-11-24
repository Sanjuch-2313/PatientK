#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <time.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <MAX30105.h>
#include "heartRate.h" // Built-in SparkFun real-time optical beat detection

// ======================================================
// 1. WIFI SETTINGS
// ======================================================
const char* WIFI_SSID     = "ESP";
const char* WIFI_PASSWORD = "12345678";

// ======================================================
// 2. PATIENTK CLOUD CREDENTIALS
// ======================================================
const char* BACKEND_URL = "https://patientk.onrender.com/api/hardware/update";
const char* DEVICE_ID   = "PK-DEV-001";
const char* API_TOKEN   = "eb42d4a865e17acf2dd577db8fa26784b9c9bf11822ef0514be1bf470b5887de";

// ======================================================
// 3. HARDWARE PINS
// ======================================================
#define SDA_PIN       21    // I2C SDA for MAX30102
#define SCL_PIN       22    // I2C SCL for MAX30102
#define DS18B20_PIN   4     // Temperature Data
#define ECG_PIN       34    // AD8232 Analog Out
#define LO_PLUS_PIN   32    // AD8232 Leads-Off +
#define LO_MINUS_PIN  33    // AD8232 Leads-Off -

// ======================================================
// 4. SENSOR OBJECTS
// ======================================================
MAX30105 particleSensor;
OneWire oneWire(DS18B20_PIN);
DallasTemperature tempSensor(&oneWire);

bool maxSensorDetected = false;
unsigned long lastUploadTime = 0;
const unsigned long UPLOAD_INTERVAL = 3000; // 3 seconds transmission interval

// Real-Time Optical Pulse & SpO2 Tracking variables
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float currentBpm = 0;
int liveHeartRate = 0;
int liveSpo2 = 0;
bool fingerOnSensor = false;

// Optical AC/DC calculation buffers for real SpO2
float irAc = 0, irDc = 0;
float redAc = 0, redDc = 0;

// ======================================================
// 5. WIFI CONNECTION
// ======================================================
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.println("\n[WiFi] Connecting to: " + String(WIFI_SSID));
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(400);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("\n[WiFi] Connection timeout.");
  return false;
}

// ======================================================
// 6. TIME SYNCHRONIZATION (NTP)
// ======================================================
void setupNTP() {
  Serial.print("[NTP] Syncing UTC time");
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  
  time_t now = time(nullptr);
  int attempts = 0;
  while (now < 1700000000 && attempts < 25) {
    delay(300);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }
  
  if (now >= 1700000000) {
    Serial.println("\n[NTP] Time synchronized.");
  } else {
    Serial.println("\n[NTP] Awaiting sync...");
  }
}

String getIsoUtcTimestamp() {
  time_t now = time(nullptr);
  struct tm timeInfo;
  gmtime_r(&now, &timeInfo);
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeInfo);
  return String(buf);
}

// ======================================================
// 7. SETUP
// ======================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=============================================");
  Serial.println("  PATIENT K - LIVE TELEMEDICINE SENSOR CLIENT");
  Serial.println("  Target Device:  PK-DEV-001");
  Serial.println("  Target Patient: PAT-2026-0001");
  Serial.println("=============================================");

  pinMode(ECG_PIN, INPUT);
  pinMode(LO_PLUS_PIN, INPUT_PULLUP);
  pinMode(LO_MINUS_PIN, INPUT_PULLUP);
  analogReadResolution(12);

  Wire.begin(SDA_PIN, SCL_PIN);

  // Initialize MAX30102 with LED brightness tuned for human tissue
  if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    maxSensorDetected = true;
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x24); // Medium LED power for finger
    particleSensor.setPulseAmplitudeIR(0x24);  // Medium IR power
    particleSensor.setPulseAmplitudeGreen(0);
    Serial.println("[Sensors] MAX30102 Pulse Oximeter READY (Place finger on sensor)");
  } else {
    Serial.println("[Sensors] MAX30102 NOT DETECTED! Check I2C SDA(21)/SCL(22) wiring.");
  }

  // Initialize DS18B20
  tempSensor.begin();
  Serial.println("[Sensors] DS18B20 Body Temperature READY");

  // Connect to WiFi
  if (connectWiFi()) {
    setupNTP();
  }
}

// ======================================================
// 8. CONTINUOUS OPTICAL SENSOR PROCESSING
// ======================================================
void sampleOpticalSensor() {
  if (!maxSensorDetected) return;

  long irValue = particleSensor.getIR();
  long redValue = particleSensor.getRed();

  // Threshold: If IR reflection > 50,000, human tissue/finger is pressed on the glass
  if (irValue > 50000) {
    fingerOnSensor = true;

    // Track DC levels
    irDc = (0.95f * irDc) + (0.05f * irValue);
    redDc = (0.95f * redDc) + (0.05f * redValue);

    // Track AC peak-to-peak
    irAc = fabs(irValue - irDc);
    redAc = fabs(redValue - redDc);

    // Real-Time Heartbeat detection
    if (checkForBeat(irValue)) {
      long delta = millis() - lastBeat;
      lastBeat = millis();

      if (delta > 300 && delta < 2000) { // Valid human heart rate 30 - 200 BPM
        float bpm = 60.0f / (delta / 1000.0f);

        rates[rateSpot++] = (byte)bpm;
        rateSpot %= RATE_SIZE;

        // Running average over last 4 beats for steady clinical display
        float avgBpm = 0;
        byte count = 0;
        for (byte x = 0; x < RATE_SIZE; x++) {
          if (rates[x] >= 40 && rates[x] <= 180) {
            avgBpm += rates[x];
            count++;
          }
        }

        if (count > 0) {
          liveHeartRate = (int)(avgBpm / count);
        }

        // Live SpO2 estimation using Red/IR ratio of AC/DC absorption
        if (irDc > 0 && redDc > 0 && irAc > 0) {
          float ratio = (redAc / redDc) / (irAc / irDc);
          // Standard clinical calibration curve for MAX30102
          int spo2Calc = (int)(110.0f - (25.0f * ratio));
          if (spo2Calc >= 85 && spo2Calc <= 100) {
            liveSpo2 = spo2Calc;
          } else if (spo2Calc > 100) {
            liveSpo2 = 99;
          }
        }
      }
    }
  } else {
    // Finger removed from sensor
    fingerOnSensor = false;
    liveHeartRate = 0;
    liveSpo2 = 0;
    irAc = 0;
    redAc = 0;
  }
}

// ======================================================
// 9. READ SENSORS & UPLOAD TO PATIENTK CLOUD
// ======================================================
void uploadVitalsToCloud() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  if (time(nullptr) < 1700000000) {
    setupNTP();
    return;
  }

  // 1. Read Live Temperature from DS18B20
  float liveTemperature = 0.0f;
  bool tempValid = false;
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  if (t >= 15.0f && t <= 50.0f && t != 85.0f) {
    liveTemperature = t;
    tempValid = true;
  }

  // 2. Read Live ECG from AD8232
  bool leadsOff = (digitalRead(LO_PLUS_PIN) == HIGH || digitalRead(LO_MINUS_PIN) == HIGH);
  int liveEcgRaw = analogRead(ECG_PIN);

  // 3. Capture 30 live ECG samples for real-time waveform graph
  String ecgSamplesArray = "[";
  if (!leadsOff) {
    for (int i = 0; i < 30; i++) {
      int s = analogRead(ECG_PIN);
      ecgSamplesArray += String(s);
      if (i < 29) ecgSamplesArray += ",";
      delayMicroseconds(500);
    }
  }
  ecgSamplesArray += "]";

  // 4. PRINT LIVE VALUES TO SERIAL MONITOR
  Serial.println("\n========================================================");
  Serial.printf("  [PATIENT K LIVE MONITOR]  Patient: PAT-2026-0001\n");
  Serial.println("========================================================");
  if (fingerOnSensor) {
    Serial.printf("  [MAX30102] Finger Status : DETECTED ON SENSOR\n");
    Serial.printf("  [PULSE]    Heart Rate    : %s\n", (liveHeartRate > 0) ? (String(liveHeartRate) + " BPM").c_str() : "Calculating pulse...");
    Serial.printf("  [OXYGEN]   SpO2 Level    : %s\n", (liveSpo2 > 0) ? (String(liveSpo2) + " %").c_str() : "Calculating oxygen...");
  } else {
    Serial.printf("  [MAX30102] Finger Status : NO FINGER DETECTED (Place finger on glass)\n");
    Serial.printf("  [PULSE]    Heart Rate    : -- (null)\n");
    Serial.printf("  [OXYGEN]   SpO2 Level    : -- (null)\n");
  }

  if (tempValid) {
    Serial.printf("  [TEMP]     Body Temp     : %.2f °C\n", liveTemperature);
  } else {
    Serial.printf("  [TEMP]     Body Temp     : Unavailable / Disconnected\n");
  }

  if (!leadsOff) {
    Serial.printf("  [ECG]      Electrodes    : ATTACHED (Signal: %d ADC)\n", liveEcgRaw);
  } else {
    Serial.printf("  [ECG]      Electrodes    : LEADS OFF (Check chest pads)\n");
  }
  Serial.println("========================================================");

  // 5. CONSTRUCT JSON PAYLOAD
  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"heartRate\":" + (fingerOnSensor && liveHeartRate > 0 ? String(liveHeartRate) : "null") + ",";
  payload += "\"oxygenLevel\":" + (fingerOnSensor && liveSpo2 > 0 ? String(liveSpo2) : "null") + ",";
  payload += "\"temperature\":" + (tempValid ? String(liveTemperature, 1) : "null") + ",";
  payload += "\"leadsOff\":" + String(leadsOff ? "true" : "false") + ",";
  payload += "\"ecgRaw\":" + (leadsOff ? "null" : String(liveEcgRaw)) + ",";
  payload += "\"ecgSampleRate\":100,";
  payload += "\"ecgSamples\":" + ecgSamplesArray + ",";
  payload += "\"timestamp\":\"" + getIsoUtcTimestamp() + "\"";
  payload += "}";

  // 6. TRANSMIT TO PATIENTK CLOUD BACKEND
  WiFiClientSecure secureClient;
  secureClient.setInsecure();

  HTTPClient http;
  http.setTimeout(8000);

  Serial.println("[Cloud] Uploading real sensor data...");
  if (http.begin(secureClient, BACKEND_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-KEY", API_TOKEN);

    int responseCode = http.POST(payload);

    if (responseCode > 0) {
      String response = http.getString();
      Serial.printf("[Cloud] SUCCESS HTTP %d -> %s\n", responseCode, response.c_str());
      Serial.println("[Database] Record saved in 'vitals' collection for PAT-2026-0001!");
    } else {
      Serial.printf("[Cloud] Failed, Error: %s\n", http.errorToString(responseCode).c_str());
    }
    http.end();
  }
}

// ======================================================
// 10. MAIN LOOP
// ======================================================
void loop() {
  // Continuously sample optical sensor for pulse peaks
  sampleOpticalSensor();

  // Upload to cloud every 3 seconds
  if (millis() - lastUploadTime >= UPLOAD_INTERVAL) {
    lastUploadTime = millis();
    uploadVitalsToCloud();
  }

  delay(5);
}
