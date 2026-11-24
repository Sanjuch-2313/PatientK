import { createHash, randomBytes } from "node:crypto";

export const generateHardwareToken = () => randomBytes(32).toString("hex");
export const hashHardwareToken = (token) => createHash("sha256").update(token).digest("hex");
export const validDeviceId = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
