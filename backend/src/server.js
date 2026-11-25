import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import vitalRoutes from "./routes/vitalRoutes.js";
import hardwareRoutes from "./routes/hardwareRoutes.js";
import careRoutes from "./routes/careRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import Device from "./models/Device.js";

dotenv.config();

const app = express();

await connectDB();
await Device.init();

const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  : [];
const allowedOrigins = configuredOrigins.length
  ? [...new Set(["https://patientk.netlify.app", ...configuredOrigins])]
  : true;
const localOriginPattern = /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(?::\d+)?$/i;
const corsOptions = {
  origin: (requestOrigin, callback) => {
    if (
      !requestOrigin ||
      allowedOrigins === true ||
      allowedOrigins.includes(requestOrigin) ||
      localOriginPattern.test(requestOrigin)
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-KEY"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Patient K Backend is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/vitals", vitalRoutes);
app.use("/api/hardware", hardwareRoutes);
app.use("/api/care", careRoutes);
app.use("/api/ai", aiRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.type === "entity.parse.failed" ? 400 : error.type === "entity.too.large" ? 413 : 500;
  res.status(status).json({ success: false, message: status === 400 ? "Invalid JSON body." : status === 413 ? "Request body too large." : "Unexpected server error." });
});
const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
