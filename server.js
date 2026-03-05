const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const SolarReading = require("./models/SolarReading");
const DailyEnergy = require("./models/DailyEnergy");
const MonthlyEnergy = require("./models/MonthlyEnergy");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

/* ======================================
   HELPER FUNCTIONS
====================================== */
// FORMAT DATE AS YYYY-MM-DD
function formatDateYYYYMMDD(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// FORMAT DATE AS YYYY-MM
function formatMonthYYYYMM(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/* ======================================
   ENERGY CALCULATION
====================================== */
async function calculateAndStoreEnergy(dateInput) {
  try {
    const dateStr = formatDateYYYYMMDD(dateInput);

    const start = new Date(dateStr + "T00:00:00");
    const end = new Date(dateStr + "T23:59:59.999");

    const readings = await SolarReading.find({
      recordedAt: { $gte: start, $lte: end }
    }).sort({ recordedAt: 1 });

    if (readings.length === 0) return;

    const MAX_POWER = 3.6;
    const PANEL_EFFICIENCY = 0.65;

    let powers = readings.map((r) => {
      const elevation = Math.min(90, Math.max(0, Number(r.elevation) || 0));
      const elevationRad = (elevation * Math.PI) / 180;
      return MAX_POWER * Math.sin(elevationRad) * PANEL_EFFICIENCY;
    });

    const totalPower = powers.reduce((a, b) => a + b, 0);
    const avgPower = totalPower / powers.length;

    const totalRounded = Number(totalPower.toFixed(2));
    const avgRounded = Number(avgPower.toFixed(2));

    // UPSERT daily energy
    await DailyEnergy.findOneAndUpdate(
      { date: dateStr },
      { totalPower: totalRounded, avgPower: avgRounded },
      { upsert: true, new: true }
    );

    console.log("Daily Energy updated for:", dateStr);

    // ALSO update monthly energy
    await calculateAndStoreMonthlyEnergy(dateInput);

  } catch (err) {
    console.error("Daily Energy Calculation Error:", err);
  }
}

// MONTHLY ENERGY CALCULATION
async function calculateAndStoreMonthlyEnergy(dateInput) {
  try {
    const monthStr = formatMonthYYYYMM(dateInput);

    const dailyRecords = await DailyEnergy.find({
      date: { $regex: `^${monthStr}-` } // all days in month
    });

    if (dailyRecords.length === 0) return;

    const totalPowerSum = dailyRecords.reduce((sum, r) => sum + r.totalPower, 0);
    const avgPowerAvg = dailyRecords.reduce((sum, r) => sum + r.avgPower, 0) / dailyRecords.length;

    const totalRounded = Number(totalPowerSum.toFixed(2));
    const avgRounded = Number(avgPowerAvg.toFixed(2));

    // UPSERT monthly energy
    await MonthlyEnergy.findOneAndUpdate(
      { month: monthStr },
      { totalPower: totalRounded, avgPower: avgRounded },
      { upsert: true, new: true }
    );

    console.log("Monthly Energy updated for:", monthStr);

  } catch (err) {
    console.error("Monthly Energy Calculation Error:", err);
  }
}

/* ======================================
   MONGODB CONNECTION
====================================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Atlas Connected");

    const changeStream = SolarReading.watch();

    changeStream.on("change", async (change) => {
      if (change.operationType === "insert") {
        console.log("New Solar Data Inserted");

        io.emit("new-solar-data", change.fullDocument);

        const insertedDate = change.fullDocument.recordedAt;
        await calculateAndStoreEnergy(insertedDate);
      }
    });

  })
  .catch((err) => console.error("MongoDB Connection Error:", err));

/* ======================================
   API ROUTES
====================================== */

// All readings
app.get("/api/solar-readings", async (req, res) => {
  try {
    const readings = await SolarReading.find().sort({ recordedAt: 1 });
    res.json(readings);
  } catch (err) {
    res.status(500).json({ message: "Error fetching data" });
  }
});

// Today's stored energy
app.get("/api/daily-energy/today", async (req, res) => {
  try {
    const todayStr = formatDateYYYYMMDD(new Date());
    const energy = await DailyEnergy.findOne({ date: todayStr });

    res.json({
      totalPower: energy ? energy.totalPower : 0,
      avgPower: energy ? energy.avgPower : 0
    });

  } catch (err) {
    res.status(500).json({ totalPower: 0, avgPower: 0 });
  }
});

// Current month's stored energy
app.get("/api/monthly-energy/current", async (req, res) => {
  try {
    const monthStr = formatMonthYYYYMM(new Date());
    const energy = await MonthlyEnergy.findOne({ month: monthStr });

    res.json({
      totalPower: energy ? energy.totalPower : 0,
      avgPower: energy ? energy.avgPower : 0
    });
  } catch (err) {
    res.status(500).json({ totalPower: 0, avgPower: 0 });
  }
});

/* ======================================
   START SERVER
====================================== */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));