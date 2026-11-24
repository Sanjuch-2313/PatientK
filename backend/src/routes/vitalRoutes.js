import express from "express";
import Vital from "../models/Vital.js";
import EcgTrace from "../models/EcgTrace.js";

const router = express.Router();


// ==========================================
// SAVE VITALS
// POST /api/vitals
// ==========================================

router.post("/", (_req, res) => res.status(410).json({ message: "Submit measurements through the authenticated hardware API." }));

router.get("/:patientId/ecg", async (req, res) => {
  try {
    const traces = await EcgTrace.find({
      patientId: req.params.patientId,
      capturedAt: { $gte: new Date(Date.now() - 20000) },
    }).sort({ capturedAt: -1 }).limit(7).lean();
    if (!traces.length) return res.status(404).json({ message: "No recent ECG trace found." });
    return res.json({ traces: traces.reverse() });
  } catch {
    return res.status(500).json({ message: "Unable to load ECG trace." });
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
      patientId, source: "sensor", measuredAt: { $gte: new Date(Date.now() - 15000) },
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
        patientId, source: "sensor",
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
