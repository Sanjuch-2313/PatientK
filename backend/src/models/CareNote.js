import mongoose from "mongoose";

const careNoteSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true, maxlength: 64 },
  authorName: { type: String, required: true, trim: true, maxlength: 120 },
  authorRole: { type: String, enum: ["doctor", "nurse"], required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true });

export default mongoose.model("CareNote", careNoteSchema);
