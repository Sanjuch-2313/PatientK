import mongoose from "mongoose";

const treatmentAssignmentSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true, maxlength: 64 },
  doctorId: { type: String, required: true, maxlength: 64 },
  doctorName: { type: String, required: true, trim: true, maxlength: 120 },
  department: { type: String, trim: true, maxlength: 120, default: "General care" },
  status: { type: String, enum: ["active", "referred"], default: "active" },
  referredById: { type: String, maxlength: 64 },
  referredByName: { type: String, trim: true, maxlength: 120 },
}, { timestamps: true });

treatmentAssignmentSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

export default mongoose.model("TreatmentAssignment", treatmentAssignmentSchema);
