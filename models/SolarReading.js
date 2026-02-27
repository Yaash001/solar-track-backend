const mongoose = require("mongoose");

const solarReadingSchema = new mongoose.Schema({
  azimuth: {
    type: Number,
    required: true
  },
  elevation: {
    type: Number,
    required: true
  },
  recordedAt: {
    type: Date,
    required: true
  }
}, { collection: "datas" });

module.exports = mongoose.model("SolarReading", solarReadingSchema);