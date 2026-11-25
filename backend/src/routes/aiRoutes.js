import express from "express";
import Vital from "../models/Vital.js";
import Device from "../models/Device.js";

const router = express.Router();

const cToF = (c) => (typeof c === "number" && Number.isFinite(c) ? Number(((c * 1.8) + 32).toFixed(1)) : null);

const avgOf = (arr) => {
  const valid = arr.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
};

const rangeOf = (arr) => {
  const valid = arr.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  return { min: Math.min(...valid), max: Math.max(...valid) };
};

router.post("/chat", async (req, res) => {
  try {
    const { message, patientId } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Please enter a question." });
    }

    const q = message.trim().toLowerCase();
    const cleanPatientId = typeof patientId === "string" && patientId.trim() ? patientId.trim() : null;

    let recentVitals = [];
    let device = null;

    if (cleanPatientId) {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      [recentVitals, device] = await Promise.all([
        Vital.find({
          patientId: cleanPatientId,
          source: "sensor",
          measuredAt: { $gte: twoDaysAgo },
        })
          .sort({ measuredAt: -1 })
          .limit(60)
          .lean(),
        Device.findOne({ monitoringPatientId: cleanPatientId })
          .select("deviceId name active lastSeen")
          .lean(),
      ]);
    }

    const latest = recentVitals[0] || null;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    const todayVitals = recentVitals.filter((v) => new Date(v.measuredAt) >= startOfToday);
    const yesterdayVitals = recentVitals.filter(
      (v) => new Date(v.measuredAt) >= startOfYesterday && new Date(v.measuredAt) < startOfToday
    );

    const hrPoints = recentVitals
      .slice(0, 14)
      .reverse()
      .map((v) => v.heartRate)
      .filter((v) => typeof v === "number");

    const spo2Points = recentVitals
      .slice(0, 14)
      .reverse()
      .map((v) => v.spo2)
      .filter((v) => typeof v === "number");

    const tempPointsF = recentVitals
      .slice(0, 14)
      .reverse()
      .map((v) => cToF(v.temperature))
      .filter((v) => typeof v === "number");

    let reply = "";
    let chart = null;
    let seekHelp = null;

    // 1. GREETING
    if (/^(hi|hello|hey|good morning|good evening|good afternoon)\b/.test(q)) {
      reply = latest
        ? `Hi there! I'm patienkbot.ai, your personal health assistant. Your latest sensor check for ${cleanPatientId} shows ${
            latest.heartRate != null ? `a heart rate of ${latest.heartRate} BPM` : "no finger heart-rate reading yet"
          }${latest.spo2 != null ? `, SpO2 at ${latest.spo2}%` : ""}${
            latest.temperature != null ? `, and skin temperature at ${cToF(latest.temperature)}°F` : ""
          }. What would you like me to explain?`
        : "Hi there! I'm patienkbot.ai, your personal health assistant. You can ask me about your heart rate, SpO2, temperature, alerts, or compare today's readings with yesterday.";
    }
    // 2. COMPARE TODAY VS YESTERDAY
    else if (q.includes("yesterday") || q.includes("compare")) {
      const tHr = avgOf(todayVitals.map((v) => v.heartRate));
      const yHr = avgOf(yesterdayVitals.map((v) => v.heartRate));
      const tSp = avgOf(todayVitals.map((v) => v.spo2));
      const ySp = avgOf(yesterdayVitals.map((v) => v.spo2));
      const tTemp = avgOf(todayVitals.map((v) => cToF(v.temperature)));
      const yTemp = avgOf(yesterdayVitals.map((v) => cToF(v.temperature)));

      if (!todayVitals.length && !yesterdayVitals.length) {
        reply = "I don't see recorded sensor readings for today or yesterday yet. Once your ESP32 monitor sends readings, I can compare both days for you.";
      } else if (!yesterdayVitals.length) {
        reply = `Today you have ${todayVitals.length} recorded sensor check(s) (average Heart Rate: ${
          tHr ?? "—"
        } BPM, SpO2: ${tSp ?? "—"}%, Temp: ${tTemp ?? "—"}°F). There are no recorded readings from yesterday to compare against yet.`;
      } else {
        reply = `Here is how today compares with yesterday for ${cleanPatientId}:\n• Heart Rate: Today averages ${
          tHr ?? "—"
        } BPM vs ${yHr ?? "—"} BPM yesterday.\n• Blood Oxygen (SpO2): Today averages ${
          tSp ?? "—"
        }% vs ${ySp ?? "—"}% yesterday.\n• Temperature: Today averages ${
          tTemp ?? "—"
        }°F vs ${yTemp ?? "—"}°F yesterday.`;
      }

      chart = {
        type: "comparison",
        title: "Today vs Yesterday (Averages)",
        bars: [
          { label: "HR (BPM)", today: tHr ?? 0, yesterday: yHr ?? 0 },
          { label: "SpO2 (%)", today: tSp ?? 0, yesterday: ySp ?? 0 },
          { label: "Temp (°F)", today: tTemp ?? 0, yesterday: yTemp ?? 0 },
        ],
      };
    }
    // 3. EXPLAIN HEART RATE
    else if (q.includes("heart rate") || q.includes("bpm") || q.includes("pulse")) {
      const hrRange = rangeOf(hrPoints);
      const hrAvg = avgOf(hrPoints);
      if (latest?.heartRate != null) {
        const stateText =
          latest.heartRate > 120
            ? "higher than a typical resting pace"
            : latest.heartRate < 50
            ? "slower than a typical resting pace"
            : "within a typical resting range (around 60–100 BPM)";
        reply = `Your heart rate measures how many times your heart beats each minute. Your latest reading is ${latest.heartRate} BPM, which is ${stateText}. Over your recent readings, your heart rate has ranged from ${hrRange.min} to ${hrRange.max} BPM (average ${hrAvg} BPM).`;
        if (latest.heartRate > 120 || latest.heartRate < 50) {
          seekHelp = "If your resting heart rate stays above 120 BPM or below 50 BPM, or if you feel dizzy, short of breath, or have chest discomfort, contact your doctor or seek medical care.";
        }
      } else {
        reply = "Heart rate (BPM) counts how many times your heart beats per minute. For most adults at rest, 60–100 BPM is typical. I don't have a recent finger reading right now—place your finger gently on the MAX30102 sensor to record one.";
      }

      if (hrPoints.length >= 2) {
        chart = {
          type: "sparkline",
          title: "Recent Heart Rate Trend",
          unit: "BPM",
          color: "#115e3b",
          values: hrPoints,
        };
      }
    }
    // 4. WHAT DOES SPO2 MEAN
    else if (q.includes("spo2") || q.includes("oxygen")) {
      const spAvg = avgOf(spo2Points);
      reply = `SpO2 stands for blood oxygen saturation—it shows the percentage of oxygen carried by your red blood cells. A typical healthy reading is between 95% and 100%.${
        latest?.spo2 != null
          ? ` Your latest recorded reading is ${latest.spo2}% (recent average ${spAvg ?? latest.spo2}%).`
          : " Place your fingertip gently on the sensor to capture a live reading."
      }`;
      if (latest?.spo2 != null && latest.spo2 < 95) {
        seekHelp = "An SpO2 reading below 95% can happen if your finger is cold or loose on the sensor. Warm your hand and re-check. If it stays below 92% or you feel breathless, seek medical help promptly.";
      }
      if (spo2Points.length >= 2) {
        chart = {
          type: "sparkline",
          title: "Recent SpO2 Trend",
          unit: "%",
          color: "#0ea5e9",
          values: spo2Points,
        };
      }
    }
    // 5. WHY DID I GET AN ALERT
    else if (q.includes("alert") || q.includes("buzzer") || q.includes("beep") || q.includes("warning")) {
      const flagged = recentVitals.find(
        (v) =>
          (v.heartRate != null && (v.heartRate > 120 || v.heartRate < 50)) ||
          (v.spo2 != null && v.spo2 < 95) ||
          (v.temperature != null && (v.temperature >= 37.8 || v.temperature <= 35.0))
      );

      if (flagged) {
        const reasons = [];
        if (flagged.heartRate != null && flagged.heartRate > 120) reasons.push(`elevated heart rate (${flagged.heartRate} BPM)`);
        if (flagged.heartRate != null && flagged.heartRate < 50) reasons.push(`low heart rate (${flagged.heartRate} BPM)`);
        if (flagged.spo2 != null && flagged.spo2 < 95) reasons.push(`lower SpO2 (${flagged.spo2}%)`);
        if (flagged.temperature != null && flagged.temperature >= 37.8) reasons.push(`high temperature (${cToF(flagged.temperature)}°F)`);
        if (flagged.temperature != null && flagged.temperature <= 35.0) reasons.push(`low temperature reading (${cToF(flagged.temperature)}°F)`);

        const when = new Date(flagged.measuredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        reply = `An alert is triggered automatically whenever a sensor reading crosses preset safety limits. At ${when}, your monitor recorded ${reasons.join(", ")}. Sometimes this happens briefly if a probe isn't touching your skin firmly.`;
        seekHelp = "Sit calmly, re-check the sensor contact for 15 seconds. If the reading stays unusual or you feel unwell (chest pain, faintness, trouble breathing, or fever), contact your care team right away.";
      } else {
        reply = "I checked your recent 48-hour sensor history and didn't find any out-of-range vital readings. If the buzzer beeped briefly, it can happen when a temperature probe isn't touching warm skin yet (reading below 95°F) or when a finger is lifted mid-reading.";
      }
    }
    // 6. UNUSUAL READING / WHAT SHOULD I DO
    else if (q.includes("unusual") || q.includes("weird") || q.includes("wrong") || q.includes("what should i do")) {
      reply =
        "If a reading looks unusual, don't panic—wearable sensors are sensitive to movement:\n1. Rest your finger gently on the optical sensor without pressing hard.\n2. Warm your hands if they feel cold.\n3. Make sure the temperature probe is pressed against dry skin.\n4. Sit still for 15–20 seconds and watch the next reading.";
      seekHelp =
        "Seek immediate medical attention if unusual readings come with chest pain, severe shortness of breath, dizziness, confusion, or a persistent SpO2 below 92%.";
    }
    // 7. HOW WAS MY HEALTH TODAY
    else if (q.includes("today") || q.includes("how was my health") || q.includes("summary")) {
      const tHr = avgOf(todayVitals.map((v) => v.heartRate));
      const tSp = avgOf(todayVitals.map((v) => v.spo2));
      const tTemp = avgOf(todayVitals.map((v) => cToF(v.temperature)));

      if (todayVitals.length) {
        reply = `Today you've logged ${todayVitals.length} sensor readings. Your averages today are ${
          tHr != null ? `${tHr} BPM heart rate` : "no heart rate yet"
        }, ${tSp != null ? `${tSp}% SpO2` : "no SpO2 yet"}, and ${
          tTemp != null ? `${tTemp}°F temperature` : "no temperature yet"
        }. Overall, your monitor is tracking smoothly.`;
      } else {
        reply = `I don't see any readings logged yet for today (${cleanPatientId || "your profile"}). Connect your ESP32 device to start recording today's trends.`;
      }

      if (hrPoints.length >= 2) {
        chart = {
          type: "sparkline",
          title: "Today's Heart Rate Trend",
          unit: "BPM",
          color: "#115e3b",
          values: hrPoints,
        };
      }
    }
    // 8. TEMPERATURE / ECG / GENERAL FALLBACK
    else if (q.includes("temp")) {
      const tAvg = avgOf(tempPointsF);
      reply = latest?.temperature != null
        ? `Your latest skin temperature is ${cToF(latest.temperature)}°F (recent average ${tAvg ?? cToF(latest.temperature)}°F). Skin temperature is usually slightly cooler than an oral thermometer.`
        : "Your DS18B20 temperature probe measures contact temperature. Hold it gently against your skin for ~15 seconds for an accurate reading.";
      if (tempPointsF.length >= 2) {
        chart = {
          type: "sparkline",
          title: "Recent Temperature Trend",
          unit: "°F",
          color: "#f97316",
          values: tempPointsF,
        };
      }
    } else {
      reply = latest
        ? `I'm patienkbot.ai! Based on your latest check (${new Date(latest.measuredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}), your Heart Rate is ${
            latest.heartRate ?? "—"
          } BPM, SpO2 is ${latest.spo2 ?? "—"}%, and Temperature is ${
            cToF(latest.temperature) ?? "—"
          }°F. Try asking me to explain your heart rate, SpO2, alerts, or compare today with yesterday.`
        : "I'm patienkbot.ai! I can help explain your heart rate, blood oxygen (SpO2), temperature, alerts, or compare today's readings with yesterday. What would you like to know?";
    }

    return res.json({
      success: true,
      reply,
      chart,
      seekHelp,
      disclaimer: "patienkbot.ai provides simple explanations of your sensor data and never diagnoses medical conditions.",
      deviceOnline: Boolean(device?.active && device?.lastSeen && Date.now() - new Date(device.lastSeen).getTime() <= 15000),
    });
  } catch (error) {
    console.error("patienkbot.ai error:", error);
    return res.status(500).json({ success: false, message: "patienkbot.ai could not respond right now." });
  }
});

export default router;
