import Vital from "../models/Vital.js";
import EcgTrace from "../models/EcgTrace.js";
import Device from "../models/Device.js";
import { generateHardwareToken, hashHardwareToken, validDeviceId } from "../utils/hardwareToken.js";

const isBody = (body) => body && typeof body === "object" && !Array.isArray(body);
const fail = (res, status, message) => res.status(status).json({ success: false, message });

export async function createDevice(req, res) {
  const body = req.body;
  if (!isBody(body) || !validDeviceId(body.deviceId) || typeof body.name !== "string" ||
      !body.name.trim() || body.name.trim().length > 120 ||
      Object.keys(body).some((key) => !["deviceId", "name"].includes(key))) {
    return fail(res, 400, "Provide a valid deviceId and a name of 1–120 characters; only these fields are accepted.");
  }
  try {
    const apiToken = generateHardwareToken();
    const device = await Device.create({ deviceId: body.deviceId, name: body.name.trim(), apiTokenHash: hashHardwareToken(apiToken) });
    res.set("Cache-Control", "no-store");
    return res.status(201).json({ success: true, device: { id: device._id, deviceId: device.deviceId, name: device.name }, apiToken });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.deviceId) return fail(res, 409, "Device ID already registered.");
    if (error.name === "ValidationError") return fail(res, 400, "Invalid device registration data.");
    return fail(res, 500, "Unable to register device.");
  }
}

// Null means unavailable; never substitute a previous or generated measurement.
export async function receiveHardwareUpdate(req, res) {
  const body = req.body;
  const ranges = { heartRate: [20, 250], oxygenLevel: [0, 100], temperature: [-20, 80],
    ambientTemperature: [-40, 85], humidity: [0, 100], ecgRaw: [0, 4095] };
  const fields = ["deviceId", "timestamp", "leadsOff", "ecgSampleRate", "ecgSamples", ...Object.keys(ranges)];
  const validNumber = (value, [min, max]) => value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
  const hasEcgTrace = "ecgSampleRate" in body || "ecgSamples" in body;
  const validEcgTrace = !hasEcgTrace ||
    (body.ecgSampleRate === 100 && Array.isArray(body.ecgSamples) && body.ecgSamples.length <= 300 &&
      body.ecgSamples.every((sample) => Number.isInteger(sample) && sample >= 0 && sample <= 4095) &&
      !(body.leadsOff === true && body.ecgSamples.length > 0));
  if (!isBody(body) || !validDeviceId(body.deviceId) || Object.keys(body).some(key => !fields.includes(key)) ||
      !["heartRate", "oxygenLevel", "temperature"].every(key => key in body) ||
      !Object.entries(ranges).every(([key, range]) => !(key in body) || validNumber(body[key], range)) ||
      ("leadsOff" in body && typeof body.leadsOff !== "boolean") ||
      (body.leadsOff === true && body.ecgRaw != null) ||
      !validEcgTrace ||
      typeof body.timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.timestamp) ||
      !Number.isFinite(Date.parse(body.timestamp)) || Math.abs(Date.now() - Date.parse(body.timestamp)) > 30000) {
    return fail(res, 400, "Provide current timestamp (within 30 seconds), nullable sensor numbers within hardware limits, and valid fields.");
  }
  if (body.deviceId !== req.device.deviceId) return fail(res, 403, "Token does not belong to this deviceId.");
  if (!req.device.monitoringPatientId) return fail(res, 409, "Assign monitoringPatientId to the device before sending readings.");
  try {
    const measuredAt = new Date(body.timestamp);
    await Vital.create({ patientId: req.device.monitoringPatientId, deviceId: body.deviceId,
      heartRate: body.heartRate, spo2: body.oxygenLevel, temperature: body.temperature,
      ambientTemperature: body.ambientTemperature ?? null, humidity: body.humidity ?? null,
      ecgRaw: body.ecgRaw ?? null, leadsOff: body.leadsOff, measuredAt, source: "sensor" });
    if (hasEcgTrace) {
      await EcgTrace.create({ patientId: req.device.monitoringPatientId, deviceId: body.deviceId,
        capturedAt: measuredAt, sampleRateHz: body.ecgSampleRate, leadsOff: body.leadsOff, samples: body.ecgSamples });
    }
    return res.json({ success: true, message: "Hardware data saved", deviceId: req.device.deviceId });
  } catch {
    return fail(res, 500, "Unable to save hardware data.");
  }
}
