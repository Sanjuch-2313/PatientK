import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import vitalRoutes from "./routes/vitalRoutes.js";

dotenv.config();

const app = express();

connectDB();

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Patient K Backend is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/vitals", vitalRoutes);
const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});