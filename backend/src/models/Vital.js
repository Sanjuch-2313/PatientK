import mongoose from "mongoose";

const vitalSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      index: true,
    },

    heartRate: {
      type: Number,
      required: true,
    },

    spo2: {
      type: Number,
      required: true,
    },

    systolic: {
      type: Number,
      required: true,
    },

    diastolic: {
      type: Number,
      required: true,
    },

    temperature: {
      type: Number,
      required: true,
    },

    source: {
      type: String,
      enum: ["synthetic", "raspberry-pi", "sensor"],
      default: "synthetic",
    },
  },
  {
    timestamps: true,
  }
);

const Vital = mongoose.model("Vital", vitalSchema);

export default Vital;