const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    age: {
      type: Number,
      required: true,
    },

    gender: {
      type: String,
    },

    roomNumber: {
      type: String,
    },

    temperature: {
      type: Number,
      default: null,
    },

    heartRate: {
      type: Number,
      default: null,
    },

    oxygenSaturation: {
      type: Number,
      default: null,
    },

    systolicBP: {
      type: Number,
      default: null,
    },

    diastolicBP: {
      type: Number,
      default: null,
    },

    status: {
      type: String,
      enum: ["stable", "warning", "critical"],
      default: "stable",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Patient", patientSchema);