import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Device from "../models/Device.js";
import { generateHardwareToken, hashHardwareToken } from "../utils/hardwareToken.js";

const router = express.Router();


// ========================================
// REGISTER
// ========================================

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    let patientId = undefined;
    let deviceData = null;
    let apiToken = null;

    if (role === "patient") {
      const patientCount = await User.countDocuments({
        role: "patient",
      });

      const nextNumber = patientCount + 1;

      patientId = `PAT-${new Date().getFullYear()}-${String(
        nextNumber
      ).padStart(4, "0")}`;

      const deviceId = `PK-DEV-${String(nextNumber).padStart(4, "0")}`;
      apiToken = generateHardwareToken();

      // Ensure no collision if deviceId already exists
      let finalDeviceId = deviceId;
      const existingDev = await Device.findOne({ deviceId: finalDeviceId });
      if (existingDev) {
        finalDeviceId = `PK-DEV-${Date.now().toString().slice(-6)}`;
      }

      const createdDevice = await Device.create({
        deviceId: finalDeviceId,
        name: `${name.trim()}'s ESP32 Monitor`,
        monitoringPatientId: patientId,
        apiTokenHash: hashHardwareToken(apiToken),
        active: true,
      });

      deviceData = {
        deviceId: createdDevice.deviceId,
        name: createdDevice.name,
        monitoringPatientId: createdDevice.monitoringPatientId,
      };
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      patientId,
    });

    res.set("Cache-Control", "no-store");
    res.status(201).json({
      message: "Registration successful.",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        patientId: user.patientId || null,
      },
      device: deviceData,
      apiToken,
    });

  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Server error during registration.",
    });
  }
});


// ========================================
// LOGIN
// ========================================

router.post("/login", async (req, res) => {
  try {

    console.log("LOGIN REQUEST RECEIVED");

    const {
      email,
      password,
    } = req.body;

    console.log("Email:", email);

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    console.log("LOGIN SUCCESS:", user.email);

    res.status(200).json({
      message: "Login successful",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        patientId: user.patientId || null,
      },
    });

  } catch (error) {

    console.error("Login error:", error);

    res.status(500).json({
      message: "Server error during login.",
    });
  }
});


export default router;
