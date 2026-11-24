import { Router } from "express";
import { createDevice, receiveHardwareUpdate, assignDevice } from "../controllers/hardwareController.js";
import hardwareAuth from "../middleware/hardwareAuth.js";

const router = Router();
router.post("/register", createDevice);
router.post("/assign", assignDevice);
router.post("/update", hardwareAuth, receiveHardwareUpdate);
export default router;
