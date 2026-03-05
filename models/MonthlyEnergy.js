const mongoose = require("mongoose");

const monthlyEnergySchema = new mongoose.Schema({
  month: {
    type: String,      // format YYYY-MM, e.g., "2026-03"
    required: true,
    unique: true
  },
  totalPower: {
    type: Number,
    required: true
  },
  avgPower: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model("MonthlyEnergy", monthlyEnergySchema);