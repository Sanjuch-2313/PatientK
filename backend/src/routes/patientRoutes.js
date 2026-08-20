const express = require("express");
const Patient = require("../models/Patient");

const router = express.Router();

// GET all patients
router.get("/", async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });

    res.json(patients);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch patients",
    });
  }
});

// GET one patient
router.get("/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    res.json(patient);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch patient",
    });
  }
});

module.exports = router;