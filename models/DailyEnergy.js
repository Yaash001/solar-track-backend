const mongoose = require("mongoose");

const dailyEnergySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true, // one record per day
  },
  powerOutput: {
    type: Number, // stored in Wh
    required: true,
  },
});

module.exports = mongoose.model("DailyEnergy", dailyEnergySchema);