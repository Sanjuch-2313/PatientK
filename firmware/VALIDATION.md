# Validation record

Date: 2026-10-27

| Check | Result |
| --- | --- |
| Backend HTTP/model contract tests (`npm test --prefix backend`) | PASS: 3 test groups |
| Frontend production build (`npm run build --prefix frontend`) | PASS |
| Whitespace check (`git diff --check`) | PASS |
| ESP32 firmware build | PASS: PlatformIO esp32dev, 970409 bytes flash, 49652 bytes RAM; placeholder config |
| Live MongoDB persistence test | Not run; requires configured server/database |
| Flash/upload on actual ESP32 | Not run; board unavailable |
| Optical accuracy and motion artifacts | Pending engineer test |
| NTC calibration | Pending actual probe specifications; disabled by default |
| ECG/PCB signal integrity and isolation | Pending engineer test |

Build warnings: upstream SparkFun library redefines I2C_BUFFER_LENGTH (32 versus ESP32 Wire default 128); build succeeds. Bundled esptool also emits a Python SyntaxWarning. Actual acquisition timing and FIFO behavior still require bench testing.

## Engineer results to complete

Board/PCB revision:

Actual GPIO/address mapping:

NTC part number, measured fixed resistor/supply, Beta/R25:

Reference instruments and calibration dates:

Stationary optical comparison, no-finger and motion results:

NTC reference comparisons and open/short results:

ECG lead-off, output disconnect/bias and simulator results:

Wi-Fi/backend outage and stale-display results:

Decision (accept for bench prototype / changes required) and reasons:
