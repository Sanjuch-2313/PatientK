# PatientK ESP32 hardware handoff

The previous dashboard generated random measurements and the hardware endpoint only acknowledged requests. This implementation removes that generator, stores authenticated sensor packets, and displays unavailable/stale data without filling gaps. It is a bench-test prototype, not a validated medical instrument. Software cannot guarantee accurate readings from wiring faults, motion or an uncalibrated PCB.

## Build and configure

Use an ESP32 DevKit (classic dual-core ESP32, not C3/S2). In `firmware/PatientK`, copy `config.example.h` to `config.h` and enter Wi-Fi, registered device ID, API token, HTTPS endpoint and the issuing root CA PEM (a C++ raw string is convenient). Never disable certificate verification. Then run `pio run`, `pio run -t upload`, and `pio device monitor`. Alternatively open `PatientK.ino` in Arduino IDE with the ESP32 board package and the libraries/versions in `platformio.ini`.

Firmware successfully compiled for esp32dev with PlatformIO using placeholder configuration (970409 bytes flash, 49652 bytes RAM). No physical board was available. Build and bench-test again after entering the actual configuration. See [validation record](VALIDATION.md).

Register using `backend/API_HARDWARE.md`. A trusted database administrator must then set `devices.monitoringPatientId` to the **exact application patient ID string**, e.g. `PAT-2026-0001`. This separate field avoids confusing the existing `patientId` ObjectId reference with the application ID. No assignment is accepted from sensor packets. Example in mongosh, using your actual database:

```js
db.devices.updateOne({deviceId: "PK-DEVICE-001"}, {$set: {monitoringPatientId: "PAT-2026-0001"}})
```

The firmware sends once per second. Serial prints measurements even without Wi-Fi; HTTPS upload requires Wi-Fi, NTP clock synchronization and a valid CA. A separate task handles network delays, and only the newest queued packet is kept. API 200 means saved; 409 means device has no patient assignment; negative HTTP codes indicate transport failure. Missing sensors detected at startup require a reboot after reconnection.

## Proposed pin mapping — engineer must match custom PCB

| Signal | ESP32 / connection |
| --- | --- |
| Shared I2C SDA / SCL | GPIO21 / GPIO22 |
| MAX30102 | I2C 0x57; red + IR mode |
| ADS1115 | I2C 0x48 (ADDR to GND), A0 thermistor divider |
| BME280 | I2C 0x76 or 0x77; BMP280 cannot measure humidity |
| AD8232 OUT | GPIO34, 0–3.3V only |
| AD8232 LO+ / LO− | GPIO32 / GPIO33; high means lead off |
| NTC divider | 3.3V → measured 10k fixed resistor → ADS A0 → 10k NTC → GND |
| Grounds | Common sensor/ESP32 ground |

Use 3.3V logic/pull-ups. Confirm each breakout's regulator and supply requirements; bare MAX30102 and breakout modules have different power requirements. Confirm AD8232 shutdown is held enabled by the PCB. GPIO34 floats if AD8232 OUT is disconnected: the PCB needs a defined bias (engineer-approved pull-down) and intact lead-off wiring. Software cannot detect every floating analog signal. Use a battery-powered isolated setup for electrodes; have the engineer verify patient isolation before attaching electrodes while USB, chargers or other equipment are connected.

## Measurement behavior and limitations

* MAX30102 uses the SparkFun/Maxim algorithm at 25 effective samples/second, a four-second window and one-second updates. No-finger/low-signal, clipping, sample gaps and algorithm-invalid results clear readings. Contact thresholds need characterization on the actual module. Algorithm validity is not a motion-artifact or clinical-accuracy guarantee. No smoothing with fabricated defaults is used.
* ADS1115 reads the NTC continuously. Open/short divider rails are rejected. `NTC_CALIBRATED` defaults to false, so contact temperature stays null. Measure the fixed resistor, supply and NTC resistance/Beta from its datasheet; compare with calibrated temperature references at multiple points before enabling. A generic “10k NTC” does not establish Beta or core body temperature.
* BME280 temperature/humidity are **ambient** fields, never a body-temperature fallback.
* AD8232 sends one raw ADC diagnostic sample per second plus lead-off status. It is **not a streamed ECG waveform**, calibrated ECG voltage, arrhythmia detector or source of reported BPM. Rails and lead-off yield null; a disconnected/failed analog module cannot always be detected in software. Waveform acquisition requires a separate timed sampler and buffered transport.
* None of these components directly measures systolic/diastolic blood pressure. Those fields remain null.
* API timestamps must be within 30 seconds of the server clock. Latest-patient reads exclude non-sensor and older-than-15-second records. The patient page polls every three seconds and clears unavailable data. Legacy synthetic history is excluded. Range checks are hardware plausibility checks, not a diagnosis or proof of signal quality.
* Existing patient read APIs and provisioning need access control before deployment outside a trusted test network. This change does not establish a production patient authorization system.

## Engineer acceptance tests (record results, do not assume pass)

1. Check PCB schematic, supply rails, pull-ups, pin mapping and addresses; build and flash. At boot verify each device is detected; absent devices must give null, not nominal readings.
2. With no finger, expect heartRate/oxygenLevel null. Attach a stationary finger, allow at least four seconds; compare against a reference instrument over several minutes. Remove finger, cover/illuminate the sensor, move the hand and saturate the optical signal; record false-valid results and tune/reject accordingly.
3. Leave NTC calibration disabled: temperature must be null even when BME280 works. Calibrate NTC, then disconnect and short the probe: no retained temperature. Compare normal operation at several known temperatures.
4. Disconnect each I2C sensor during operation. Its data must become unavailable; reconnect and reboot. Test stuck-bus faults separately; if PCB faults prevent reliable acquisition, readings must not be accepted as validated.
5. Disconnect ECG electrodes: leadsOff true and ecgRaw null. Check OUT disconnect with actual PCB bias. Use an isolated ECG simulator to evaluate analog signal quality; no patient waveform claims follow from this diagnostic sample.
6. Provision a device and assign the correct patient. Verify API 200 and MongoDB sensor records with null blood pressure. Wrong token → 401, wrong device → 403, no assignment → 409, stale timestamp/out-of-range packet → 400. Check actual reference measurements are what appear on the patient dashboard.
7. Disable Wi-Fi/backend. Patient readings must disappear after the freshness window (up to ~18 seconds including polling); reconnect and ensure no backlog of old measurements is replayed. Confirm no random generator writes records and no old synthetic record appears as live.

Hardware acceptance is pending until the engineer supplies the actual pinout, thermistor specifications/calibration and recorded bench results.

## Implementation references

* SparkFun MAX3010x Example8: https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library/blob/master/examples/Example8_SPO2/Example8_SPO2.ino
* Adafruit ADS1X15 API: https://github.com/adafruit/Adafruit_ADS1X15
* AD8232 datasheet/product: https://www.analog.com/en/products/ad8232.html
