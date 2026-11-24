import { Router } from "express";
import CareNote from "../models/CareNote.js";
import Device from "../models/Device.js";

const router = Router();
const validPatientId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);

router.get("/:patientId/device", async (req, res) => {
  if (!validPatientId(req.params.patientId)) return res.status(400).json({ message: "Invalid patient ID." });
  try {
    const device = await Device.findOne({ monitoringPatientId: req.params.patientId })
      .select("deviceId name active lastSeen").lean();
    if (!device) return res.status(404).json({ message: "No monitoring device assigned." });
    const online = Boolean(device.active && device.lastSeen && Date.now() - new Date(device.lastSeen).getTime() <= 15000);
    return res.json({ device: { ...device, online } });
  } catch {
    return res.status(500).json({ message: "Unable to load device status." });
  }
});

router.get("/:patientId/notes", async (req, res) => {
  if (!validPatientId(req.params.patientId)) return res.status(400).json({ message: "Invalid patient ID." });
  try {
    const notes = await CareNote.find({ patientId: req.params.patientId }).sort({ createdAt: -1 }).limit(25).lean();
    return res.json({ notes });
  } catch {
    return res.status(500).json({ message: "Unable to load care notes." });
  }
});

router.post("/:patientId/notes", async (req, res) => {
  const { authorName, authorRole, text } = req.body || {};
  if (!validPatientId(req.params.patientId) || typeof authorName !== "string" || !authorName.trim() ||
      !["doctor", "nurse"].includes(authorRole) || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ message: "Provide a patient ID, clinician name, role and note." });
  }
  try {
    const note = await CareNote.create({ patientId: req.params.patientId, authorName: authorName.trim(), authorRole, text: text.trim() });
    return res.status(201).json({ note });
  } catch {
    return res.status(500).json({ message: "Unable to save care note." });
  }
});

export default router;
