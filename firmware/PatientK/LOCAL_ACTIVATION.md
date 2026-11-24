# PatientK ESP32 activation

This firmware replaces the engineer's ESP32 browser dashboard. It keeps the physical LCD, but sends measurements to the PatientK backend every three seconds. It is built for the supplied breadboard hardware: MAX30102, DS18B20, AD8232 and 16x2 I2C LCD.

## 1. Start PatientK on the Mac

Run MongoDB, then start the backend:

```sh
cd /Applications/PatientK/backend
npm start
```

In another terminal, start the dashboard:

```sh
cd /Applications/PatientK/frontend
npm run dev
```

## 2. Use one shared Wi-Fi network

Connect the Mac and ESP32 to the **same normal Wi-Fi router**. Do not use the old ESP32 hotspot (`192.168.4.1`); the firmware no longer creates that hotspot.

On the Mac, find its IP address on that Wi-Fi:

```sh
ipconfig getifaddr en0
```

Example result: `192.168.1.20`.

## 3. Register and pair the device

Register the ESP32 once. Keep the returned API token private.

```sh
curl -X POST http://localhost:5005/api/hardware/register \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"PK-DEVICE-001","name":"PatientK ESP32 Monitor","monitoringPatientId":"PAT-2026-0001"}'
```

Create a patient account in PatientK first and use its Patient ID, for example `PAT-2026-0001`, in the registration request. The registration stores that assignment in `monitoringPatientId`.

```js
db.devices.updateOne(
  { deviceId: "PK-DEVICE-001" },
  { $set: { monitoringPatientId: "PAT-2026-0001" } }
)
```

## 4. Configure and upload

Copy `config.example.h` to `config.h`. Set the Wi-Fi details, device ID, API token and the Mac IP.

```cpp
#define API_URL "http://192.168.1.20:5005/api/hardware/update"
#define PATIENTK_USE_HTTPS false
```

Use your own Mac IP in place of `192.168.1.20`. `localhost` is wrong because it means the ESP32 itself. `192.168.4.1` was the old local ESP32 webpage and is no longer used.

Upload `PatientK.ino` in Arduino IDE with board **ESP32 Dev Module**. Required libraries are listed in `platformio.ini`:

- SparkFun MAX3010x Pulse and Proximity Sensor Library
- DallasTemperature
- OneWire
- LiquidCrystal I2C

## 5. Confirm the connection

Open Serial Monitor at `115200` baud. Expected output includes:

```text
MAX30102=1 DS18B20=1
Wi-Fi connected. ESP32 IP: ...
PatientK API status: 200
{"success":true,"message":"Hardware data saved",...}
```

If the status is `401`, the token is wrong. If `403`, device ID does not match the token. If `409`, the device has not been paired to a Patient ID. If it is `0` or negative, the ESP32 cannot reach the Mac IP/port.

The MAX30102 needs about four seconds of a steady finger signal before it can report valid heart rate and SpO₂. Unavailable readings are sent as `null`; PatientK displays `—`, never random values.

## Deploying later

For a deployed backend, use HTTPS, set `PATIENTK_USE_HTTPS true`, configure `API_URL` with the public backend address, and put the backend's root CA certificate in `ROOT_CA`.
