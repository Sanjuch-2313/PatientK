#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <time.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <algorithm>
#include "MAX30105.h"
#include "spo2_algorithm.h"

// ======================================================
// 1. WIFI SETTINGS
// ======================================================
const char* WIFI_SSID     = "ESP";
const char* WIFI_PASSWORD = "12345678";

// ======================================================
// 2. PATIENTK CLOUD CREDENTIALS
// ======================================================
const char* BACKEND_URL  = "https://patientk.onrender.com/api/hardware/update";
const char* BACKEND_PING = "https://patientk.onrender.com/";   // Wake-up ping
const char* DEVICE_ID    = "PK-DEV-0001";
const char* API_TOKEN    = "00fbdcfe3fa817376e6786e5e86300f3b63593e61217872c9b24b3e270af537e";

// ======================================================
// 3. HARDWARE PINS
// ======================================================
#define SDA_PIN         21
#define SCL_PIN         22
#define DS18B20_PIN     4
#define ECG_PIN         34
#define LO_PLUS_PIN     32
#define LO_MINUS_PIN    33
#define BUZZER_PIN      25
#define BUZZER_LEDC_CH  0        // LEDC channel 0 (free on ESP32)
#define BUZZER_FREQ_HZ  2500     // 2.5 kHz works for both active & passive buzzers
#define BUZZER_ON_LEVEL HIGH

// ======================================================
// 4. CRITICAL ALARM THRESHOLDS
// ======================================================
const int   HR_CRIT_HIGH   = 140;
const int   HR_CRIT_LOW    = 40;
const int   SPO2_CRIT      = 90;
const float TEMP_CRIT_HIGH = 39.5f;
const float TEMP_CRIT_LOW  = 35.0f;

// ======================================================
// 5. MAX30102 BUFFER — 100 samples @ 100 Hz = 1 second
//    sampleAverage=1 so chip outputs all 100 Hz to FIFO
// ======================================================
#define BUF_LEN  100
// *** Lowered from 50000 → 30000 ***
// Many sensors/fingers don't reach 50000 raw IR units.
// 30000 reliably detects any fingertip contact.
const uint32_t FINGER_IR_MIN = 30000;

// ======================================================
// 6. SHARED VITALS — written by sensor task (Core 1),
//    read by upload task (Core 0). Protected by mutex.
// ======================================================
SemaphoreHandle_t vitalsMutex;

struct SharedVitals {
  int   bpm        = 0;
  int   spo2       = 0;
  bool  hrOk       = false;
  bool  spOk       = false;
  bool  finger     = false;
  float tempC      = 0.0f;
  bool  tempValid  = false;
  bool  leadsOff   = true;
  int   ecgRaw     = 0;
  int   ecgBuf[30];
  int   ecgIdx     = 0;
  bool  critical   = false;
};
SharedVitals vitals;

// ======================================================
// 7. SENSOR-TASK PRIVATE STATE (Core 1 only — no mutex)
// ======================================================
MAX30105 particleSensor;
bool maxSensorDetected = false;

uint32_t irBuf[BUF_LEN], redBuf[BUF_LEN];
int     bufCount    = 0;
int     sinceCalc   = 0;
int     noFingerCnt = 0;
int32_t spo2Calc = 0, hrCalc = 0;
int8_t  spo2Valid = 0, hrValid = 0;
bool    fingerOnSensor = false;
uint32_t lastIr   = 0;
unsigned long lastHrMs = 0, lastSpMs = 0;

struct Median5 {
  int v[5]; int n; int i;
  Median5() : n(0), i(0) {}
  void push(int x) { v[i] = x; i = (i + 1) % 5; if (n < 5) n++; }
  void clear()     { n = 0; i = 0; }
  int value() {
    if (n == 0) return 0;
    int t[5];
    for (int k = 0; k < n; k++) t[k] = v[k];
    std::sort(t, t + n);
    return t[n / 2];
  }
};
Median5 hrAvg, spAvg;
int  realBpm = 0, realSpo2 = 0;
bool hrOk    = false, spOk = false;

// ECG at 100 Hz
unsigned long lastEcgUs = 0;

// Temperature (read in upload task, shared via vitals struct)
OneWire oneWire(DS18B20_PIN);
DallasTemperature tempSensor(&oneWire);

// Buzzer
unsigned long lastBuzzerToggle = 0;
bool buzzerState = false;

// Upload interval
const unsigned long UPLOAD_INTERVAL = 3000;

// FreeRTOS task handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t uploadTaskHandle = NULL;

// ======================================================
// 8. WIFI
// ======================================================
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println("\n[WiFi] Connecting to: " + String(WIFI_SSID));
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(400); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    return true;
  }
  Serial.println("\n[WiFi] Timeout.");
  return false;
}

// ======================================================
// 9. NTP
// ======================================================
void setupNTP() {
  Serial.print("[NTP] Syncing");
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  time_t now = time(nullptr);
  for (int i = 0; i < 25 && now < 1700000000; i++) {
    delay(300); Serial.print("."); now = time(nullptr);
  }
  if (now >= 1700000000) Serial.println("\n[NTP] OK");
}

String getIsoUtcTimestamp() {
  time_t now = time(nullptr);
  struct tm ti; gmtime_r(&now, &ti);
  char buf[30]; strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &ti);
  return String(buf);
}

// ======================================================
// 10. PPG ALGORITHM (runs on sensor task, Core 1)
// ======================================================
void resetPpg() {
  bufCount = sinceCalc = 0;
  hrAvg.clear(); spAvg.clear();
  lastHrMs = lastSpMs = 0;
  realBpm = realSpo2 = 0;
  hrOk = spOk = false;
}

void calcVitals() {
  maxim_heart_rate_and_oxygen_saturation(
      irBuf, BUF_LEN, redBuf,
      &spo2Calc, &spo2Valid,
      &hrCalc,   &hrValid);

  unsigned long now = millis();

  if (hrValid && hrCalc >= 40 && hrCalc <= 200) {
    hrAvg.push((int)hrCalc);
    lastHrMs = now;
    Serial.printf("[PPG] HR=%d bpm\n", (int)hrCalc);
  }

  if (spo2Valid && spo2Calc >= 70 && spo2Calc <= 100) {
    spAvg.push((int)spo2Calc);
    lastSpMs = now;
    Serial.printf("[PPG] SpO2=%d%%\n", (int)spo2Calc);
  } else {
    // AC/DC ratio fallback when algorithm returns invalid
    long irSum = 0, redSum = 0;
    for (int k = 0; k < BUF_LEN; k++) { irSum += irBuf[k]; redSum += redBuf[k]; }
    float irDC  = (float)irSum  / BUF_LEN;
    float redDC = (float)redSum / BUF_LEN;
    float irMax = -1e9, irMin = 1e9, rMax = -1e9, rMin = 1e9;
    for (int k = 0; k < BUF_LEN; k++) {
      float ia = (float)irBuf[k]  - irDC;
      float ra = (float)redBuf[k] - redDC;
      if (ia > irMax) irMax = ia; if (ia < irMin) irMin = ia;
      if (ra > rMax)  rMax  = ra; if (ra < rMin)  rMin  = ra;
    }
    float irSpan = irMax - irMin, rSpan = rMax - rMin;
    if (irDC > 0 && redDC > 0 && irSpan > 50.0f) {
      float ratio = (rSpan / redDC) / (irSpan / irDC);
      int fb = (int)(110.0f - 25.0f * ratio);
      if (fb >= 70 && fb <= 100) {
        spAvg.push(fb); lastSpMs = now;
        Serial.printf("[PPG] SpO2 fallback=%d%%\n", fb);
      }
    }
  }
}

void processSample(uint32_t red, uint32_t ir) {
  lastIr = ir;
  if (ir < FINGER_IR_MIN) {
    if (noFingerCnt < 12) noFingerCnt++;
    if (noFingerCnt >= 12 && fingerOnSensor) { fingerOnSensor = false; resetPpg(); }
    return;
  }
  noFingerCnt = 0; fingerOnSensor = true;

  if (bufCount < BUF_LEN) {
    irBuf[bufCount] = ir; redBuf[bufCount] = red; bufCount++;
    if (bufCount == BUF_LEN) calcVitals();
    return;
  }
  memmove(irBuf,  irBuf  + 1, (BUF_LEN - 1) * sizeof(uint32_t));
  memmove(redBuf, redBuf + 1, (BUF_LEN - 1) * sizeof(uint32_t));
  irBuf[BUF_LEN - 1] = ir; redBuf[BUF_LEN - 1] = red;
  if (++sinceCalc >= 25) { sinceCalc = 0; calcVitals(); }
}

void refreshLocalVitals() {
  unsigned long now = millis();
  hrOk    = fingerOnSensor && hrAvg.n > 0 && (now - lastHrMs < 20000);
  spOk    = fingerOnSensor && spAvg.n > 0 && (now - lastSpMs < 20000);
  realBpm  = hrOk ? hrAvg.value() : 0;
  realSpo2 = spOk ? spAvg.value() : 0;
}

// ======================================================
// BUZZER HELPERS — use LEDC (safe inside FreeRTOS tasks)
// tone() uses a hardware timer that conflicts with RTOS.
// ledcWrite() uses the PWM peripheral — always reliable.
// ======================================================
void buzzerOn() {
  ledcWrite(BUZZER_LEDC_CH, 128);   // 50% duty = audible tone
}
void buzzerOff() {
  ledcWrite(BUZZER_LEDC_CH, 0);     // 0 duty = silence
  digitalWrite(BUZZER_PIN, LOW);    // ensure pin is fully LOW
}
void buzzerBeep(int durationMs) {   // blocking beep for startup only
  buzzerOn();
  delay(durationMs);
  buzzerOff();
}

// ======================================================
// 11. SENSOR TASK — pinned to Core 1, HIGH priority
//     Never blocked by WiFi. Runs every ~1 ms.
// ======================================================
void sensorTask(void* param) {
  Serial.println("[SensorTask] Started on Core 1");

  while (true) {
    // ── A. ECG at 100 Hz ──────────────────────────────
    unsigned long nowUs = micros();
    if (nowUs - lastEcgUs >= 10000) {
      lastEcgUs = nowUs;
      int sample = analogRead(ECG_PIN);
      if (xSemaphoreTake(vitalsMutex, 0) == pdTRUE) {
        vitals.ecgBuf[vitals.ecgIdx] = sample;
        vitals.ecgIdx = (vitals.ecgIdx + 1) % 30;
        vitals.leadsOff = (digitalRead(LO_PLUS_PIN) == HIGH ||
                           digitalRead(LO_MINUS_PIN) == HIGH);
        vitals.ecgRaw = sample;
        xSemaphoreGive(vitalsMutex);
      }
    }

    // ── B. MAX30102 FIFO drain ─────────────────────────
    if (maxSensorDetected) {
      particleSensor.check();
      while (particleSensor.available()) {
        uint32_t red = particleSensor.getFIFORed();
        uint32_t ir  = particleSensor.getFIFOIR();
        particleSensor.nextSample();
        processSample(red, ir);
      }
      refreshLocalVitals();

      // ── C. Write vitals to shared struct ─────────────
      bool crit = false;
      if (hrOk && (realBpm > HR_CRIT_HIGH || realBpm < HR_CRIT_LOW)) crit = true;
      if (spOk && realSpo2 < SPO2_CRIT)                               crit = true;
      if (xSemaphoreTake(vitalsMutex, 0) == pdTRUE) {
        vitals.bpm    = realBpm;
        vitals.spo2   = realSpo2;
        vitals.hrOk   = hrOk;
        vitals.spOk   = spOk;
        vitals.finger = fingerOnSensor;
        vitals.critical = crit;
        xSemaphoreGive(vitalsMutex);
      }
    }

    // ── D. Buzzer (LEDC-based, safe in FreeRTOS) ─────────
    bool isCrit = false;
    if (xSemaphoreTake(vitalsMutex, 0) == pdTRUE) {
      isCrit = vitals.critical;
      if (vitals.tempValid &&
          (vitals.tempC >= TEMP_CRIT_HIGH || vitals.tempC <= TEMP_CRIT_LOW))
        isCrit = true;
      xSemaphoreGive(vitalsMutex);
    }
    if (isCrit) {
      if (millis() - lastBuzzerToggle >= 300) {
        lastBuzzerToggle = millis();
        buzzerState = !buzzerState;
        buzzerState ? buzzerOn() : buzzerOff();
      }
    } else if (buzzerState) {
      buzzerState = false;
      buzzerOff();
    }

    vTaskDelay(pdMS_TO_TICKS(1));   // yield 1 ms
  }
}

// ======================================================
// 12. UPLOAD TASK — pinned to Core 0
//     Blocking HTTP is fine here — sensor task keeps running
// ======================================================
void uploadTask(void* param) {
  Serial.println("[UploadTask] Started on Core 0");

  // Send a one-time wake-up GET to prevent Render cold-start delay
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure sc; sc.setInsecure();
    HTTPClient h; h.setTimeout(25000);
    if (h.begin(sc, BACKEND_PING)) {
      h.GET();   // fire-and-forget, ignore response
      h.end();
      Serial.println("[Cloud] Wake-up ping sent to Render.");
    }
    vTaskDelay(pdMS_TO_TICKS(3000)); // give Render 3s to wake before first real upload
  }

  while (true) {
    vTaskDelay(pdMS_TO_TICKS(UPLOAD_INTERVAL));

    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
      if (WiFi.status() == WL_CONNECTED && time(nullptr) < 1700000000) {
        setupNTP();
      }
      continue;
    }

    // Ensure NTP clock is synced before sending timestamped payload
    if (time(nullptr) < 1700000000) {
      setupNTP();
      if (time(nullptr) < 1700000000) {
        Serial.println("[NTP] Waiting for valid UTC time before uploading...");
        continue;
      }
    }

    // ── Snapshot shared vitals ────────────────────────
    int   bpm, spo2, ecgRaw, ecgIdx;
    bool  hrOkSnap, spOkSnap, finger, leadsOff, tempValid, critical;
    float tempC, tempF = 0;
    int   ecgSnap[30];

    // Read temperature in this task (DS18B20 is slow, ~750 ms)
    tempSensor.requestTemperatures();
    float t = tempSensor.getTempCByIndex(0);
    if (t >= 20.0f && t <= 45.0f && t != 85.0f) {
      tempC = t; tempF = t * 1.8f + 32.0f; tempValid = true;
    } else {
      tempC = 0; tempValid = false;
    }

    if (xSemaphoreTake(vitalsMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      bpm      = vitals.bpm;
      spo2     = vitals.spo2;
      hrOkSnap = vitals.hrOk;
      spOkSnap = vitals.spOk;
      finger   = vitals.finger;
      leadsOff = vitals.leadsOff;
      ecgRaw   = vitals.ecgRaw;
      ecgIdx   = vitals.ecgIdx;
      memcpy(ecgSnap, vitals.ecgBuf, sizeof(ecgSnap));
      critical = vitals.critical;
      // Store temperature back so sensor task can use for buzzer
      vitals.tempC     = tempC;
      vitals.tempValid = tempValid;
      xSemaphoreGive(vitalsMutex);
    } else {
      continue;  // couldn't get mutex, skip this cycle
    }

    // ── Serial diagnostics ────────────────────────────
    Serial.println("\n========================================================");
    Serial.printf("  [PATIENT K]  PAT-2026-0001  buf:%d/%d\n", bufCount, BUF_LEN);
    Serial.println("========================================================");
    if (finger) {
      Serial.printf("  Finger   : DETECTED  IR=%lu\n", (unsigned long)lastIr);
      Serial.printf("  Pulse    : %s\n",
        hrOkSnap ? (String(bpm) + " BPM").c_str()
                 : bufCount < BUF_LEN ? "Filling buffer..." : "Acquiring...");
      Serial.printf("  SpO2     : %s\n",
        spOkSnap ? (String(spo2) + " %").c_str()
                 : bufCount < BUF_LEN ? "Filling buffer..." : "Acquiring...");
    } else {
      Serial.printf("  Finger   : NO FINGER (place fingertip on sensor)\n");
      Serial.printf("  Pulse    : -- (null)\n");
      Serial.printf("  SpO2     : -- (null)\n");
    }
    if (tempValid) Serial.printf("  Temp     : %.2f F  (%.1f C)\n", tempF, tempC);
    else           Serial.printf("  Temp     : Sensor not in contact\n");
    Serial.printf("  ECG      : %s\n", leadsOff ? "LEADS OFF" : "ATTACHED");
    if (critical)  Serial.println("  ALERT    : CRITICAL VITALS! BUZZER ACTIVE!");
    Serial.println("========================================================");

    // ── Build JSON ────────────────────────────────────
    String ecgArr = "[";
    if (!leadsOff) {
      for (int i = 0; i < 30; i++) {
        int idx = (ecgIdx + i) % 30;
        ecgArr += String(ecgSnap[idx]);
        if (i < 29) ecgArr += ",";
      }
    }
    ecgArr += "]";

    String payload = "{";
    payload += "\"deviceId\":\""  + String(DEVICE_ID)   + "\",";
    payload += "\"heartRate\":"   + (hrOkSnap && bpm  > 0 ? String(bpm)  : "null") + ",";
    payload += "\"oxygenLevel\":" + (spOkSnap && spo2 > 0 ? String(spo2) : "null") + ",";
    payload += "\"temperature\":" + (tempValid ? String(tempC, 1)         : "null") + ",";
    payload += "\"leadsOff\":"    + String(leadsOff ? "true" : "false")   + ",";
    payload += "\"ecgRaw\":"      + (leadsOff ? "null" : String(ecgRaw))  + ",";
    payload += "\"ecgSampleRate\":100,";
    payload += "\"ecgSamples\":"  + ecgArr    + ",";
    payload += "\"timestamp\":\""  + getIsoUtcTimestamp() + "\"";
    payload += "}";

    // ── HTTPS POST (can block — sensor task still runs) ──
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    HTTPClient http;
    http.setTimeout(25000);   // 25 s — Render cold-start can take 15-20 s

    if (http.begin(secureClient, BACKEND_URL)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-KEY", API_TOKEN);
      int code = http.POST(payload);
      if (code >= 200 && code < 300) {
        Serial.printf("[Cloud] HTTP %d OK | %s\n", code, http.getString().c_str());
      } else if (code > 0) {
        Serial.printf("[Cloud] HTTP %d ERROR | %s\n", code, http.getString().c_str());
      } else {
        Serial.printf("[Cloud] Error: %s\n", http.errorToString(code).c_str());
      }
      http.end();
    }
  }
}

// ======================================================
// 13. SETUP
// ======================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=============================================");
  Serial.println("  PATIENT K - REAL-TIME SENSOR CLIENT v3");
  Serial.println("  Device:  PK-DEV-0001 | PAT-2026-0001");
  Serial.println("=============================================");

  // ECG pins
  pinMode(ECG_PIN, INPUT);
  pinMode(LO_PLUS_PIN, INPUT);
  pinMode(LO_MINUS_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(ECG_PIN, ADC_11db);

  // Buzzer — init LEDC channel (safe from any FreeRTOS task)
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  ledcSetup(BUZZER_LEDC_CH, BUZZER_FREQ_HZ, 8);  // ch=0, 2500 Hz, 8-bit PWM
  ledcAttachPin(BUZZER_PIN, BUZZER_LEDC_CH);
  buzzerBeep(300);   // 300 ms startup beep — confirms buzzer is wired correctly

  // I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);

  // MAX30102
  // sampleAverage=1 → chip outputs all 100 Hz to FIFO
  // so BUF_LEN=100 fills in exactly 1 second
  if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    maxSensorDetected = true;
    particleSensor.setup(
      0x2E,   // powerLevel  ~18 mA
      1,      // sampleAverage = 1  ← KEY: full 100 Hz output
      2,      // ledMode Red+IR
      100,    // sampleRate 100 Hz
      411,    // pulseWidth 411 µs → 18-bit ADC
      4096    // adcRange
    );
    particleSensor.setPulseAmplitudeRed(0x2E);
    particleSensor.setPulseAmplitudeIR(0x2E);
    particleSensor.clearFIFO();
    Serial.println("[Sensors] MAX30102 OK (100 Hz, avg=1, 18-bit, IR_MIN=30000)");
  } else {
    Serial.println("[Sensors] MAX30102 NOT FOUND — check SDA=21 SCL=22");
  }

  // DS18B20
  tempSensor.begin();
  tempSensor.setWaitForConversion(false);
  Serial.println("[Sensors] DS18B20 OK");

  // WiFi + NTP (before tasks start)
  if (connectWiFi()) setupNTP();

  // Create mutex
  vitalsMutex = xSemaphoreCreateMutex();

  // ── Launch FreeRTOS tasks ────────────────────────────
  // Sensor task on Core 1, priority 2 (HIGH) — never interrupted by WiFi
  xTaskCreatePinnedToCore(
    sensorTask, "SensorTask",
    8192,         // stack size
    NULL, 2,      // priority 2
    &sensorTaskHandle, 1   // Core 1
  );

  // Upload task on Core 0, priority 1 (LOW) — WiFi blocking is fine here
  xTaskCreatePinnedToCore(
    uploadTask, "UploadTask",
    16384,        // larger stack for HTTP
    NULL, 1,      // priority 1
    &uploadTaskHandle, 0   // Core 0
  );

  Serial.println("[Tasks] SensorTask(Core1) + UploadTask(Core0) launched.");
}

// ======================================================
// 14. LOOP — empty, tasks handle everything
// ======================================================
void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}
