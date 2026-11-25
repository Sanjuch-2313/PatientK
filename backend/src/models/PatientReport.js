import mongoose from "mongoose";

const patientReportSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true, maxlength: 64 },
  authorId: { type: String, required: true, maxlength: 64 },
  authorName: { type: String, required: true, trim: true, maxlength: 120 },
  authorRole: { type: String, enum: ["doctor", "nurse"], required: true },
  symptoms: { type: String, trim: true, maxlength: 3000, default: "" },
  history: { type: String, trim: true, maxlength: 5000, default: "" },
  assessment: { type: String, trim: true, maxlength: 3000, default: "" },
}, { timestamps: true });

patientReportSchema.index({ patientId: 1, createdAt: -1 });

export default mongoose.model("PatientReport", patientReportSchema);
