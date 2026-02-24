const mongoose = require("mongoose");

const solarReadingSchema = new mongoose.Schema({
  azimuth: Number,
  elevation: Number,
  timestamp: Number
}, { collection: "datas" }); 

module.exports = mongoose.model("SolarReading", solarReadingSchema);