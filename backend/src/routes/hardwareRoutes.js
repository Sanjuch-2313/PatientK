import { Router } from "express";
import { createDevice, receiveHardwareUpdate, assignDevice, provisionPatientDevice, rotateDeviceToken } from "../controllers/hardwareController.js";
import hardwareAuth from "../middleware/hardwareAuth.js";

const router = Router();
router.post("/register", createDevice);
router.post("/assign", assignDevice);
router.post("/provision-patient", provisionPatientDevice);
router.post("/rotate-token", rotateDeviceToken);
router.post("/update", hardwareAuth, receiveHardwareUpdate);
export default router;
