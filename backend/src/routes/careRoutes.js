import { Router } from "express";
import CareNote from "../models/CareNote.js";
import Device from "../models/Device.js";
import PatientReport from "../models/PatientReport.js";
import TreatmentAssignment from "../models/TreatmentAssignment.js";
import User from "../models/User.js";

const router = Router();
const validPatientId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

router.get("/doctors", async (req, res) => {
  try {
    const doctors = await User.find({ role: "doctor" })
      .select("name email")
      .sort({ name: 1 })
      .lean();
    return res.json({ doctors });
  } catch {
    return res.status(500).json({ message: "Unable to load registered doctors." });
  }
});

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

router.get("/:patientId/reports", async (req, res) => {
  if (!validPatientId(req.params.patientId)) return res.status(400).json({ message: "Invalid patient ID." });
  try {
    const reports = await PatientReport.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 }).limit(30).lean();
    return res.json({ reports });
  } catch {
    return res.status(500).json({ message: "Unable to load patient reports." });
  }
});

router.post("/:patientId/reports", async (req, res) => {
  const { authorId, authorName, authorRole, symptoms, history, assessment } = req.body || {};
  if (!validPatientId(req.params.patientId) || !clean(authorId, 64) || !clean(authorName, 120) ||
      !["doctor", "nurse"].includes(authorRole) ||
      (!clean(symptoms, 3000) && !clean(history, 5000) && !clean(assessment, 3000))) {
    return res.status(400).json({ message: "Provide a clinician and at least one report field." });
  }
  try {
    const report = await PatientReport.create({
      patientId: req.params.patientId,
      authorId: clean(authorId, 64),
      authorName: clean(authorName, 120),
      authorRole,
      symptoms: clean(symptoms, 3000),
      history: clean(history, 5000),
      assessment: clean(assessment, 3000),
    });
    return res.status(201).json({ report });
  } catch {
    return res.status(500).json({ message: "Unable to save patient report." });
  }
});

router.get("/:patientId/treatment", async (req, res) => {
  if (!validPatientId(req.params.patientId)) return res.status(400).json({ message: "Invalid patient ID." });
  try {
    const assignments = await TreatmentAssignment.find({ patientId: req.params.patientId })
      .sort({ updatedAt: -1 }).lean();
    return res.json({ assignments });
  } catch {
    return res.status(500).json({ message: "Unable to load treatment assignments." });
  }
});

router.post("/:patientId/treatment", async (req, res) => {
  const { doctorId, doctorName, department } = req.body || {};
  if (!validPatientId(req.params.patientId) || !clean(doctorId, 64) || !clean(doctorName, 120)) {
    return res.status(400).json({ message: "Provide a doctor and patient ID." });
  }
  try {
    const assignment = await TreatmentAssignment.findOneAndUpdate(
      { patientId: req.params.patientId, doctorId: clean(doctorId, 64) },
      { patientId: req.params.patientId, doctorId: clean(doctorId, 64), doctorName: clean(doctorName, 120), department: clean(department, 120) || "General care", status: "active" },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ assignment });
  } catch {
    return res.status(500).json({ message: "Unable to add patient to treatment." });
  }
});

router.post("/:patientId/referrals", async (req, res) => {
  const { doctorId, doctorName, department, referredById, referredByName } = req.body || {};
  if (!validPatientId(req.params.patientId) || !clean(doctorId, 64) || !clean(doctorName, 120) ||
      !clean(referredById, 64) || !clean(referredByName, 120)) {
    return res.status(400).json({ message: "Provide the receiving doctor and referring clinician." });
  }
  try {
    const assignment = await TreatmentAssignment.findOneAndUpdate(
      { patientId: req.params.patientId, doctorId: clean(doctorId, 64) },
      { patientId: req.params.patientId, doctorId: clean(doctorId, 64), doctorName: clean(doctorName, 120), department: clean(department, 120) || "General care", status: "referred", referredById: clean(referredById, 64), referredByName: clean(referredByName, 120) },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ assignment });
  } catch {
    return res.status(500).json({ message: "Unable to refer patient." });
  }
});

export default router;
