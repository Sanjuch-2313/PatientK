import mongoose from "mongoose";

const ecgTraceSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  capturedAt: { type: Date, required: true, index: true },
  sampleRateHz: { type: Number, required: true, min: 1, max: 250 },
  leadsOff: { type: Boolean, required: true },
  samples: { type: [Number], default: [] },
}, { timestamps: true });

ecgTraceSchema.index({ patientId: 1, capturedAt: -1 });

export default mongoose.model("EcgTrace", ecgTraceSchema);
