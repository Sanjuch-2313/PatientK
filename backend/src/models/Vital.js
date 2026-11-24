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
      default: null,
    },

    spo2: {
      type: Number,
      default: null,
    },

    systolic: {
      type: Number,
      default: null,
    },

    diastolic: {
      type: Number,
      default: null,
    },

    temperature: {
      type: Number,
      default: null,
    },

    deviceId: String,
    measuredAt: Date,
    ambientTemperature: Number,
    humidity: Number,
    ecgRaw: Number,
    leadsOff: Boolean,
    source: {
      type: String,
      enum: ["synthetic", "raspberry-pi", "sensor"],
      default: "sensor",
    },
  },
  {
    timestamps: true,
  }
);

const Vital = mongoose.model("Vital", vitalSchema);

export default Vital;