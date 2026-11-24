#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <LiquidCrystal_I2C.h>
#include <MAX30105.h>
#include <spo2_algorithm.h>
#include "config.h"

// PatientK ESP32 uploader for the engineer's MAX30102 + DS18B20 + AD8232 build.
// It deliberately has no ESP32 web server. PatientK is the only dashboard.

#ifndef PATIENTK_USE_HTTPS
#define PATIENTK_USE_HTTPS false
#endif
#ifndef ROOT_CA
#define ROOT_CA ""
#endif
#ifndef LCD_ADDRESS
#define LCD_ADDRESS 0x27
#endif
#ifndef LCD_COLUMNS
#define LCD_COLUMNS 16
#endif
#ifndef LCD_ROWS
#define LCD_ROWS 2
#endif
#ifndef DS18B20_PIN
#define DS18B20_PIN 4
#endif
#ifndef ECG_PIN
#define ECG_PIN 34
#endif
#ifndef LO_PLUS_PIN
#define LO_PLUS_PIN 32
#endif
#ifndef LO_MINUS_PIN
#define LO_MINUS_PIN 33
#endif
#ifndef FINGER_IR_MIN
#define FINGER_IR_MIN 50000UL
#endif

constexpr uint16_t PPG_SAMPLES = 100;
constexpr uint32_t UPLOAD_INTERVAL_MS = 3000;
constexpr uint16_t ECG_SAMPLE_RATE_HZ = 100;
constexpr uint16_t ECG_BATCH_SAMPLES = 300;

MAX30105 max30102;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLUMNS, LCD_ROWS);

bool max30102Ready = false;
bool lcdReady = false;
bool fingerPresent = false;
bool temperatureReady = false;
bool temperaturePending = false;
uint32_t irBuffer[PPG_SAMPLES];
uint32_t redBuffer[PPG_SAMPLES];
size_t ppgCount = 0;
uint32_t lastPpgSampleMs = 0;
uint32_t lastWindowMs = 0;
uint32_t lastTemperatureRequestMs = 0;
uint32_t lastUploadMs = 0;
float bodyTemperatureC = NAN;
int32_t heartRate = 0;
int32_t oxygenLevel = 0;
int8_t heartRateValid = 0;
int8_t oxygenLevelValid = 0;
uint16_t ecgSamples[ECG_BATCH_SAMPLES];
size_t ecgCount = 0;
uint32_t lastEcgSampleUs = 0;
int ecgLastRaw = 0;
bool ecgLeadsOff = true;

void clearPpg() {
  ppgCount = 0;
  heartRateValid = 0;
  oxygenLevelValid = 0;
  lastWindowMs = 0;
}

bool validTime() { return time(nullptr) >= 1700000000; }

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 20000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi unavailable; sensor readings will not upload.");
  }
}

void refreshWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  static uint32_t lastAttemptMs = 0;
  if (millis() - lastAttemptMs < 10000) return;
  lastAttemptMs = millis();
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void readPpg() {
  if (!max30102Ready) return;
  max30102.check();
  while (max30102.available()) {
    const uint32_t red = max30102.getRed();
    const uint32_t ir = max30102.getIR();
    max30102.nextSample();
    lastPpgSampleMs = millis();
    if (ir < FINGER_IR_MIN || red < 1000 || ir >= 260000 || red >= 260000) {
      fingerPresent = false;
      clearPpg();
      continue;
    }
    fingerPresent = true;
    irBuffer[ppgCount] = ir;
    redBuffer[ppgCount++] = red;
    if (ppgCount != PPG_SAMPLES) continue;
    maxim_heart_rate_and_oxygen_saturation(irBuffer, PPG_SAMPLES, redBuffer,
      &oxygenLevel, &oxygenLevelValid, &heartRate, &heartRateValid);
    heartRateValid = heartRateValid && heartRate >= 20 && heartRate <= 250;
    oxygenLevelValid = oxygenLevelValid && oxygenLevel >= 0 && oxygenLevel <= 100;
    lastWindowMs = millis();
    memmove(irBuffer, irBuffer + 25, 75 * sizeof(uint32_t));
    memmove(redBuffer, redBuffer + 25, 75 * sizeof(uint32_t));
    ppgCount = 75;
  }
}

void readTemperature() {
  const uint32_t now = millis();
  if (!temperaturePending && now - lastTemperatureRequestMs >= 1500) {
    ds18b20.requestTemperatures();
    lastTemperatureRequestMs = now;
    temperaturePending = true;
    return;
  }
  if (!temperaturePending || now - lastTemperatureRequestMs < 800) return;
  temperaturePending = false;
  const float candidate = ds18b20.getTempCByIndex(0);
  if (candidate == DEVICE_DISCONNECTED_C || candidate == 85.0f || candidate < -20 || candidate > 80) {
    temperatureReady = false;
    return;
  }
  bodyTemperatureC = candidate;
  temperatureReady = true;
}

void sampleEcg() {
  const uint32_t nowUs = micros();
  if (nowUs - lastEcgSampleUs < 1000000UL / ECG_SAMPLE_RATE_HZ) return;
  lastEcgSampleUs = nowUs;
  ecgLeadsOff = digitalRead(LO_PLUS_PIN) || digitalRead(LO_MINUS_PIN);
  if (ecgLeadsOff) {
    ecgCount = 0;
    return;
  }
  ecgLastRaw = analogRead(ECG_PIN);
  if (ecgLastRaw <= 10 || ecgLastRaw >= 4085) return;
  if (ecgCount < ECG_BATCH_SAMPLES) ecgSamples[ecgCount++] = ecgLastRaw;
}

void updateLcd(bool ppgFresh) {
  if (!lcdReady) return;
  lcd.clear();
  lcd.setCursor(0, 0);
  if (ppgFresh && heartRateValid) {
    lcd.printf("HR:%ld Sp:%ld", (long)heartRate, (long)(oxygenLevelValid ? oxygenLevel : 0));
  } else {
    lcd.print("Place finger");
  }
  lcd.setCursor(0, 1);
  if (temperatureReady) lcd.printf("Temp:%.1f C", bodyTemperatureC);
  else lcd.print("Temp unavailable");
}

String numberOrNull(bool isValid, float value, uint8_t decimals) {
  return isValid ? String(value, static_cast<unsigned int>(decimals)) : "null";
}

void uploadReading() {
  if (millis() - lastUploadMs < UPLOAD_INTERVAL_MS) return;
  lastUploadMs = millis();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("PatientK upload skipped: Wi-Fi disconnected");
    return;
  }
  if (!validTime()) {
    Serial.println("PatientK upload skipped: waiting for NTP time");
    return;
  }
  const bool ppgFresh = fingerPresent && lastWindowMs && millis() - lastWindowMs < 5000 && millis() - lastPpgSampleMs < 1000;
  const bool leadOff = ecgLeadsOff;
  const int ecgRaw = ecgLastRaw;
  time_t now = time(nullptr);
  struct tm utcTime;
  gmtime_r(&now, &utcTime);
  char timestamp[25];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &utcTime);
  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"heartRate\":" + numberOrNull(ppgFresh && heartRateValid, heartRate, 0) + ",";
  body += "\"oxygenLevel\":" + numberOrNull(ppgFresh && oxygenLevelValid, oxygenLevel, 0) + ",";
  body += "\"temperature\":" + numberOrNull(temperatureReady, bodyTemperatureC, 1) + ",";
  body += "\"leadsOff\":" + String(leadOff ? "true" : "false") + ",";
  body += "\"ecgRaw\":" + numberOrNull(!leadOff && ecgRaw > 10 && ecgRaw < 4085, ecgRaw, 0) + ",";
  body += "\"ecgSampleRate\":" + String(ECG_SAMPLE_RATE_HZ) + ",";
  body += "\"ecgSamples\":[";
  if (!leadOff) {
    for (size_t index = 0; index < ecgCount; index++) {
      if (index) body += ",";
      body += String(ecgSamples[index]);
    }
  }
  body += "],";
  body += "\"timestamp\":\"" + String(timestamp) + "\"}";
  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(5000);
  bool started = false;
#if PATIENTK_USE_HTTPS
  WiFiClientSecure client;
  client.setCACert(ROOT_CA);
  started = http.begin(client, API_URL);
#else
  started = http.begin(API_URL);
#endif
  if (!started) {
    Serial.println("PatientK upload failed: invalid API_URL");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-KEY", API_TOKEN);
  const int statusCode = http.POST(body);
  Serial.printf("PatientK API status: %d\n", statusCode);
  if (statusCode > 0) Serial.println(http.getString());
  http.end();
  ecgCount = 0;
}

void setup() {
  Serial.begin(115200);
  pinMode(ECG_PIN, INPUT);
  pinMode(LO_PLUS_PIN, INPUT_PULLUP);
  pinMode(LO_MINUS_PIN, INPUT_PULLUP);
  analogReadResolution(12);
  analogSetPinAttenuation(ECG_PIN, ADC_11db);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setTimeOut(20);
  lcd.init();
  lcd.backlight();
  lcdReady = true;
  lcd.print("PatientK starting");
  ds18b20.begin();
  ds18b20.setWaitForConversion(false);
  max30102Ready = max30102.begin(Wire, I2C_SPEED_FAST);
  if (max30102Ready) {
    max30102.setup(60, 4, 2, 100, 411, 4096);
    max30102.clearFIFO();
  }
  Serial.printf("MAX30102=%d DS18B20=%d\n", max30102Ready, ds18b20.getDeviceCount() > 0);
  connectWiFi();
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

void loop() {
  refreshWiFi();
  readPpg();
  readTemperature();
  sampleEcg();
  if (lastPpgSampleMs && millis() - lastPpgSampleMs > 1000) clearPpg();
  const bool ppgFresh = fingerPresent && lastWindowMs && millis() - lastWindowMs < 5000;
  updateLcd(ppgFresh);
  uploadReading();
  delay(5);
}
