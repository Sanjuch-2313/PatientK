import express from "express";
import Vital from "../models/Vital.js";

const router = express.Router();


// ==========================================
// SAVE VITALS
// POST /api/vitals
// ==========================================

router.post("/", async (req, res) => {

  try {

    const {
      patientId,
      heartRate,
      spo2,
      systolic,
      diastolic,
      temperature,
      source,
    } = req.body;


    if (!patientId) {
      return res.status(400).json({
        message: "Patient ID is required",
      });
    }


    const vital = await Vital.create({
      patientId,
      heartRate,
      spo2,
      systolic,
      diastolic,
      temperature,
      source: source || "synthetic",
    });


    res.status(201).json({
      message: "Vitals saved successfully",
      vital,
    });

  } catch (error) {

    console.error(
      "Save vitals error:",
      error
    );

    res.status(500).json({
      message: "Failed to save vitals",
    });

  }

});


// ==========================================
// GET LATEST VITALS
// GET /api/vitals/:patientId
// ==========================================

router.get("/:patientId", async (req, res) => {

  try {

    const { patientId } = req.params;

    const vital = await Vital.findOne({
      patientId,
    }).sort({
      createdAt: -1,
    });


    if (!vital) {

      return res.status(404).json({
        message: "No vital data found",
      });

    }


    res.json({
      vital,
    });

  } catch (error) {

    console.error(
      "Get vitals error:",
      error
    );

    res.status(500).json({
      message: "Failed to get vitals",
    });

  }

});


// ==========================================
// GET VITAL HISTORY
// GET /api/vitals/:patientId/history
// ==========================================

router.get(
  "/:patientId/history",
  async (req, res) => {

    try {

      const { patientId } = req.params;

      const vitals = await Vital.find({
        patientId,
      })
        .sort({
          createdAt: -1,
        })
        .limit(50);


      res.json({
        vitals,
      });

    } catch (error) {

      console.error(
        "History error:",
        error
      );

      res.status(500).json({
        message: "Failed to get history",
      });

    }

  }
);


export default router;