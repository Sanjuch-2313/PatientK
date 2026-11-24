import Device from "../models/Device.js";
import { hashHardwareToken } from "../utils/hardwareToken.js";

export default async function hardwareAuth(req, res, next) {
  const token = req.get("X-API-KEY");
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(401).json({ success: false, message: "Missing or invalid API key." });
  }
  try {
    const device = await Device.findOneAndUpdate(
      { apiTokenHash: hashHardwareToken(token), active: true },
      { $set: { lastSeen: new Date() } },
      { returnDocument: "after" },
    );
    if (!device) return res.status(401).json({ success: false, message: "Invalid or inactive API key." });
    req.device = device;
    return next();
  } catch {
    return res.status(500).json({ success: false, message: "Unable to authenticate device." });
  }
}
