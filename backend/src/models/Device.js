import mongoose from "mongoose";

const removeHash = (_doc, ret) => {
  delete ret.apiTokenHash;
  return ret;
};

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, match: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/ },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  apiTokenHash: { type: String, required: true, unique: true, select: false, match: /^[a-f0-9]{64}$/ },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", default: null },
  monitoringPatientId: { type: String, default: null, maxlength: 64 },
  active: { type: Boolean, default: true },
  lastSeen: { type: Date, default: null },
}, {
  timestamps: true,
  toJSON: { transform: removeHash },
  toObject: { transform: removeHash },
});

// Ensure 1-to-1 relationship: only one active ESP32 device per patient
deviceSchema.index({ monitoringPatientId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Device", deviceSchema);
