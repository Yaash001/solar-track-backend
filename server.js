const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const SolarReading = require("./models/SolarReading");
const DailyEnergy = require("./models/DailyEnergy");

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
   🔥 ENERGY CALCULATION FUNCTION
====================================== */

async function calculateAndStoreTodayEnergy() {
  try {
    const now = new Date();

    // ✅ SAME WORKING DATE LOGIC
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    const readings = await SolarReading.find({
      recordedAt: { $gte: start, $lt: end },
    }).sort({ recordedAt: 1 });

    if (readings.length < 2) {
      return 0;
    }

    const MAX_POWER = 3.6; // kW
    const PANEL_EFFICIENCY = 0.65;
    const MAX_ENERGY_LIMIT = 15; // kWh

    let totalEnergy = 0;

    for (let i = 1; i < readings.length; i++) {
      const prev = readings[i - 1];
      const curr = readings[i];

      const elevation = Math.min(
        90,
        Math.max(0, Number(curr.elevation) || 0)
      );

      const elevationRad = (elevation * Math.PI) / 180;

      const power =
        MAX_POWER * Math.sin(elevationRad) * PANEL_EFFICIENCY;

      const deltaTimeHr =
        (new Date(curr.recordedAt) - new Date(prev.recordedAt)) /
        (1000 * 60 * 60);

      totalEnergy += power * deltaTimeHr;
    }

    const cappedEnergy = Math.min(totalEnergy, MAX_ENERGY_LIMIT);
    const finalEnergy = Number(cappedEnergy.toFixed(2));

    // ✅ SAME WORKING SAVE LOGIC
    await DailyEnergy.findOneAndUpdate(
      { date: start },
      { powerOutput: finalEnergy },
      { upsert: true,
         returnDocument: 'after' }
    );

    return finalEnergy;

  } catch (err) {
    console.error("Energy Calculation Error:", err);
    return 0;
  }
}

/* ======================================
   ✅ MongoDB Connection + Change Stream
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

        // ✅ AUTO RECALCULATE + STORE
        await calculateAndStoreTodayEnergy();
      }
    });
  })
  .catch((err) => console.error("MongoDB Connection Error:", err));

/* ======================================
   📡 API ROUTES
====================================== */

// ✅ Get all readings
app.get("/api/solar-readings", async (req, res) => {
  try {
    const readings = await SolarReading.find().sort({ recordedAt: 1 });
    res.json(readings);
  } catch (err) {
    res.status(500).json({ message: "Error fetching solar data" });
  }
});

// ✅ Get today’s readings
app.get("/api/solar-readings/today", async (req, res) => {
  try {
    const now = new Date();

    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    const readings = await SolarReading.find({
      recordedAt: { $gte: start, $lt: end },
    }).sort({ recordedAt: 1 });

    res.json(readings);
  } catch (err) {
    res.status(500).json({ message: "Error fetching today's data" });
  }
});

// ✅ Get latest reading
app.get("/api/solar-readings/latest", async (req, res) => {
  try {
    const latest = await SolarReading.findOne().sort({ recordedAt: -1 });
    res.json(latest);
  } catch (err) {
    res.status(500).json({ message: "Error fetching latest data" });
  }
});

// ✅ Get today's stored energy
app.get("/api/daily-energy/today", async (req, res) => {
  try {
    const now = new Date();

    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const energy = await DailyEnergy.findOne({ date: start });

    res.json({
      energy: energy ? energy.powerOutput : 0,
    });
  } catch (err) {
    res.status(500).json({ energy: 0 });
  }
});

/* ======================================
   🚀 START SERVER
====================================== */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);