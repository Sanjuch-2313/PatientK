import Vital from "../models/Vital.js";
import EcgTrace from "../models/EcgTrace.js";
import Device from "../models/Device.js";
import { generateHardwareToken, hashHardwareToken, validDeviceId } from "../utils/hardwareToken.js";

const isBody = (body) => body && typeof body === "object" && !Array.isArray(body);
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const validPatientId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);

export async function createDevice(req, res) {
  const body = req.body;
  const allowedKeys = ["deviceId", "name", "monitoringPatientId"];
  if (!isBody(body) || !validDeviceId(body.deviceId) || typeof body.name !== "string" ||
      !body.name.trim() || body.name.trim().length > 120 ||
      !validPatientId(body.monitoringPatientId) ||
      Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    return fail(res, 400, "Provide a valid deviceId, monitoringPatientId and a name of 1–120 characters; only these fields are accepted.");
  }
  const monitoringPatientId = body.monitoringPatientId.trim();
  try {
    if (monitoringPatientId) {
      const existingAssignment = await Device.findOne({ monitoringPatientId });
      if (existingAssignment) {
        return fail(res, 409, `Patient ${monitoringPatientId} is already assigned to device ${existingAssignment.deviceId}. Only one ESP32 can be assigned per patient.`);
      }
    }
    const apiToken = generateHardwareToken();
    const device = await Device.create({
      deviceId: body.deviceId,
      name: body.name.trim(),
      monitoringPatientId,
      apiTokenHash: hashHardwareToken(apiToken),
    });
    res.set("Cache-Control", "no-store");
    return res.status(201).json({
      success: true,
      device: { id: device._id, deviceId: device.deviceId, name: device.name, monitoringPatientId: device.monitoringPatientId },
      apiToken,
    });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.deviceId) return fail(res, 409, "Device ID already registered.");
      if (error.keyPattern?.monitoringPatientId) return fail(res, 409, "Patient is already assigned to another device.");
    }
    if (error.name === "ValidationError") return fail(res, 400, "Invalid device registration data.");
    return fail(res, 500, "Unable to register device.");
  }
}

export async function assignDevice(req, res) {
  const { deviceId, monitoringPatientId } = req.body || {};
  if (!validDeviceId(deviceId) || typeof monitoringPatientId !== "string" || !monitoringPatientId.trim()) {
    return fail(res, 400, "Provide a valid deviceId and monitoringPatientId.");
  }
  const cleanPatientId = monitoringPatientId.trim();
  try {
    // Enforce 1-to-1 relationship: unassign this patient from any other devices first
    await Device.updateMany(
      { monitoringPatientId: cleanPatientId, deviceId: { $ne: deviceId } },
      { $set: { monitoringPatientId: null } }
    );

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: { monitoringPatientId: cleanPatientId } },
      { returnDocument: "after" }
    );
    if (!device) return fail(res, 404, "Device not found.");
    return res.json({
      success: true,
      message: `Device ${deviceId} exclusively assigned to patient ${cleanPatientId}`,
      device: { deviceId: device.deviceId, name: device.name, monitoringPatientId: device.monitoringPatientId },
    });
  } catch (error) {
    return fail(res, 500, "Unable to assign device.");
  }
}

export async function provisionPatientDevice(req, res) {
  const { monitoringPatientId } = req.body || {};
  if (!validPatientId(monitoringPatientId)) {
    return fail(res, 400, "Provide a valid monitoringPatientId.");
  }
  const cleanId = monitoringPatientId.trim();
  try {
    let device = await Device.findOne({ monitoringPatientId: cleanId });
    if (device) {
      return fail(res, 409, `Patient ${cleanId} already has device ${device.deviceId}. The existing token remains valid; use /api/hardware/rotate-token only when intentionally rotating it.`);
    }

    const apiToken = generateHardwareToken();
    const count = await Device.countDocuments();
    let deviceId = `PK-DEV-${String(count + 1).padStart(4, "0")}`;
    if (await Device.findOne({ deviceId })) {
      deviceId = `PK-DEV-${Date.now().toString().slice(-6)}`;
    }
    device = await Device.create({
      deviceId,
      name: `Patient ${cleanId} Monitor`,
      monitoringPatientId: cleanId,
      apiTokenHash: hashHardwareToken(apiToken),
      active: true,
    });

    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      message: `Device exclusively provisioned for patient ${cleanId}`,
      device: {
        deviceId: device.deviceId,
        name: device.name,
        monitoringPatientId: device.monitoringPatientId,
      },
      apiToken,
    });
  } catch (error) {
    return fail(res, 500, "Unable to provision device for patient.");
  }
}

export async function rotateDeviceToken(req, res) {
  const { deviceId } = req.body || {};
  if (!validDeviceId(deviceId)) return fail(res, 400, "Provide a valid deviceId.");
  try {
    const apiToken = generateHardwareToken();
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: { apiTokenHash: hashHardwareToken(apiToken), active: true } },
      { returnDocument: "after" },
    );
    if (!device) return fail(res, 404, "Device not found.");
    res.set("Cache-Control", "no-store");
    return res.json({
      success: true,
      device: { deviceId: device.deviceId, monitoringPatientId: device.monitoringPatientId },
      apiToken,
    });
  } catch {
    return fail(res, 500, "Unable to rotate device token.");
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
  if (body.deviceId !== req.device.deviceId) {
    return fail(res, 403, "Token does not belong to this deviceId.");
  }
  if (!req.device.monitoringPatientId) return fail(res, 409, "Assign monitoringPatientId to the device before sending readings.");
  try {
    const measuredAt = new Date(body.timestamp);
    const canonicalDeviceId = req.device.deviceId;
    await Vital.create({ patientId: req.device.monitoringPatientId, deviceId: canonicalDeviceId,
      heartRate: body.heartRate, spo2: body.oxygenLevel, temperature: body.temperature,
      ambientTemperature: body.ambientTemperature ?? null, humidity: body.humidity ?? null,
      ecgRaw: body.ecgRaw ?? null, leadsOff: body.leadsOff, measuredAt, source: "sensor" });
    if (hasEcgTrace) {
      await EcgTrace.create({ patientId: req.device.monitoringPatientId, deviceId: canonicalDeviceId,
        capturedAt: measuredAt, sampleRateHz: body.ecgSampleRate, leadsOff: body.leadsOff, samples: body.ecgSamples });
    }
    return res.json({ success: true, message: "Hardware data saved", deviceId: req.device.deviceId });
  } catch {
    return fail(res, 500, "Unable to save hardware data.");
  }
}
