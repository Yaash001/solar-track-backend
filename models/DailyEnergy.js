const mongoose = require("mongoose");

const dailyEnergySchema = new mongoose.Schema({
  date: {
    type: String,         // changed from Date → String
    required: true,
    unique: true           // ensures one document per day
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

module.exports = mongoose.model("DailyEnergy", dailyEnergySchema);