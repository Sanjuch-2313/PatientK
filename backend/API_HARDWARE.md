# Patient K hardware API

Base URL in local development: `http://localhost:5005`. Use **HTTPS** in production.

## Register a device

`POST /api/hardware/register`

This provisioning route follows the requested interface and currently has no app-level administrator authentication. Before exposing it in production, restrict it at the reverse proxy/gateway to trusted administrators (for example, authenticated provisioning access on a private network). CORS is not access control. Existing user login does not issue an administrator session, so it cannot currently secure provisioning. Apply request rate limits at the gateway.

```sh
curl -i http://localhost:5005/api/hardware/register \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"PK-DEVICE-001","name":"Patient K ICU Device 001","monitoringPatientId":"PAT-2026-0001"}'
```

Registration creates the device, stores the patient assignment, and returns a unique one-device API token. The patient ID must already exist in the Patient K user records; the device endpoint does not create a second patient account.

To reassign an existing device to another patient:

`POST /api/hardware/assign`

```sh
curl -i http://localhost:5005/api/hardware/assign \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"PK-DEVICE-001","monitoringPatientId":"PAT-2026-0001"}'
```

HTTP 201 (illustrative token placeholder):

```json
{"success":true,"device":{"id":"<MongoDB ObjectId>","deviceId":"PK-DEVICE-001","name":"Patient K ICU Device 001","monitoringPatientId":"PAT-2026-0001"},"apiToken":"<64-character lowercase hexadecimal token>"}
```

The token is shown only in this response, which uses `Cache-Control: no-store`. Securely provision it on the hardware. MongoDB stores only its SHA-256 hash. There is no token retrieval endpoint. Do not log or cache provisioning responses, API key headers, or tokens.

`deviceId` is case-sensitive: 1–64 ASCII letters, digits, underscores or hyphens, beginning with a letter or digit. `monitoringPatientId` must be the exact Patient K ID, such as `PAT-2026-0001`. `name` must contain 1–120 characters after trimming. The unique MongoDB indexes prevent duplicate device IDs, token hashes, or patient assignments; startup waits for device indexes to initialize.

## Authenticate and send data

`POST /api/hardware/update`

Send `X-API-KEY: <API_TOKEN>` with `Content-Type: application/json`. A token authenticates exactly one active device. The payload's deviceId must match that device. Each successfully authenticated request updates `lastSeen`, including authenticated requests whose payload is subsequently rejected.

```sh
# Supply DEVICE_API_TOKEN securely in your local shell; do not commit it.
curl -i http://localhost:5005/api/hardware/update \
  -H "X-API-KEY: $DEVICE_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"PK-DEVICE-001","heartRate":78,"oxygenLevel":98,"temperature":37.1,"timestamp":"2026-10-07T10:30:00Z"}'
```

Equivalent hardware HTTPS request:

```http
POST /api/hardware/update HTTP/1.1
Host: your-patientk-backend.example
X-API-KEY: <DEVICE_API_TOKEN>
Content-Type: application/json

{"deviceId":"PK-DEVICE-001","heartRate":78,"oxygenLevel":98,"temperature":37.1,"timestamp":"2026-10-07T10:30:00Z"}
```

HTTP 200:

```json
{"success":true,"message":"Hardware data received","deviceId":"PK-DEVICE-001"}
```

The device must have `monitoringPatientId` set by a trusted database administrator to the application patient ID string before ingestion (otherwise 409). Measurements are nullable: `null` means unavailable, never zero or a generated value. Required fields: deviceId, heartRate, oxygenLevel, temperature, timestamp. Optional fields: ambientTemperature, humidity, ecgRaw, leadsOff. Unknown fields are rejected. Limits: heartRate 20–250, oxygenLevel 0–100, contact temperature −20–80°C, ambient temperature −40–85°C, humidity 0–100%, ecgRaw 0–4095. These are plausibility bounds, not clinical thresholds. leadsOff=true requires ecgRaw null/absent. Timestamp must be within 30 seconds of the server clock; replace example timestamps with the current UTC time when testing.

**Readings are persisted** as source=sensor, mapped oxygenLevel→spo2, with measuredAt and the assigned patient ID. Unsupported blood pressure stays null. HTTP 200 now says `Hardware data saved`. The old unauthenticated POST /api/vitals returns 410. Latest-patient reads exclude synthetic and stale (>15 seconds) readings; sensor history remains available. Firmware, wiring assumptions and acceptance tests: [firmware handoff](../firmware/README.md).

## Errors

Errors return `{"success":false,"message":"..."}` without tokens or hashes.

| Status | Meaning |
| --- | --- |
| 400 | Invalid registration/update body or malformed JSON |
| 401 | Missing, malformed, unknown or inactive device token |
| 403 | Valid token belongs to a different deviceId |
| 409 | deviceId already registered or device has no patient assignment |
| 413 | Body exceeds Express JSON parser limit |
| 500 | Unexpected server/database failure |

To exercise missing authentication, repeat the update curl without `X-API-KEY`; use 64 zeroes for an invalid token. Repeat registration for 409. Set the device's `active` to false through trusted database administration for 401, then restore it. Inspect `lastSeen` after a valid authenticated request. Tokens cannot be revoked through an API yet; setting `active: false` revokes access.

## Configuration and verification

Backend `.env` requires `PORT` (default 5005) and `MONGO_URI`; see `.env.example`. No individual device token or frontend `VITE_` token is needed. `.env` must remain outside Git. Existing CORS behavior is preserved.

```sh
cd backend
npm start
# In another shell:
node --test test/hardware.test.js
# With the backend running and MongoDB configured:
node test/hardware-live.js
```

Automated tests exercise real Express HTTP requests against a model double and check schema configuration. They do **not** prove live MongoDB persistence. Verify registration against a running MongoDB, inspecting the collection for a hash and no raw token, then test authentication, duplicates, inactive devices and lastSeen against that live server. Configure database network access and credentials before starting. The database principal needs permission to create indexes. Protect the hardware secret in device storage, validate server TLS certificates, and redact API headers and registration bodies in infrastructure logs.

The live verification script creates a uniquely named temporary device, exercises the live server and database, and deletes that test device in a finally block. It never prints its raw token.
