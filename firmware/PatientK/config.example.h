#pragma once

// Connect the ESP32 and the Mac running the PatientK backend to the same Wi-Fi.
#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Generate this once through POST /api/hardware/register.
#define DEVICE_ID "PK-DEVICE-001"
#define API_TOKEN "PASTE_DEVICE_TOKEN_HERE"

// LOCAL TEST: replace with the Mac's Wi-Fi IP, never localhost or 192.168.4.1.
// Example: http://192.168.1.20:5005/api/hardware/update
#define API_URL "http://YOUR_MAC_LAN_IP:5005/api/hardware/update"
#define PATIENTK_USE_HTTPS false

// PRODUCTION: use HTTPS and the issuing root CA certificate.
// #define API_URL "https://api.example.com/api/hardware/update"
// #define PATIENTK_USE_HTTPS true
#define ROOT_CA ""

// Engineer's breadboard wiring.
#define SDA_PIN 21
#define SCL_PIN 22
#define DS18B20_PIN 4
#define ECG_PIN 34
#define LO_PLUS_PIN 32
#define LO_MINUS_PIN 33
#define LCD_ADDRESS 0x27
#define LCD_COLUMNS 16
#define LCD_ROWS 2
#define FINGER_IR_MIN 50000UL
