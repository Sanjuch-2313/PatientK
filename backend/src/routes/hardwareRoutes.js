import { Router } from "express";
import { createDevice, receiveHardwareUpdate } from "../controllers/hardwareController.js";
import hardwareAuth from "../middleware/hardwareAuth.js";

const router = Router();
router.post("/register", createDevice);
router.post("/update", hardwareAuth, receiveHardwareUpdate);
export default router;
