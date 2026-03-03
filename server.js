const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const SolarReading = require("./models/SolarReading");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 Create HTTP server
const server = http.createServer(app);

// 🔥 Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// ✅ Connect MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Atlas Connected");

    // 🔥 Change Stream for realtime dashboard
    const changeStream = SolarReading.watch();

    changeStream.on("change", (change) => {
      if (change.operationType === "insert") {
        console.log("New Solar Data Inserted");
        io.emit("new-solar-data", change.fullDocument);
      }
    });
  })
  .catch((err) => console.error("MongoDB Connection Error:", err));

/* ============================
   📡 API ROUTES
   ============================ */

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
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const readings = await SolarReading.find({
      recordedAt: { $gte: start, $lte: end },
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

// ✅ Get daily energy (calculated)
app.get("/api/daily-energy/today", async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const readings = await SolarReading.find({
      recordedAt: { $gte: start, $lte: end },
    }).sort({ recordedAt: 1 });

    if (readings.length < 2) return res.json({ energy: 0 });

    const MAX_POWER = 3.6; // Watts
    const PANEL_EFFICIENCY = 0.65;
    const MAX_ENERGY_LIMIT = 15; // Wh

    let totalEnergy = 0;

    for (let i = 1; i < readings.length; i++) {
      const prev = readings[i - 1];
      const curr = readings[i];

      const elevation = Math.min(90, Math.max(0, curr.elevation));
      const elevationRad = (elevation * Math.PI) / 180;

      const power = MAX_POWER * Math.sin(elevationRad) * PANEL_EFFICIENCY;

      const deltaTimeHr =
        (new Date(curr.recordedAt) - new Date(prev.recordedAt)) /
        (1000 * 60 * 60);

      totalEnergy += power * deltaTimeHr;
    }

    const cappedEnergy = Math.min(totalEnergy, MAX_ENERGY_LIMIT);

    res.json({ energy: cappedEnergy });
  } catch (err) {
    console.error("Error calculating daily energy:", err);
    res.status(500).json({ energy: 0, message: "Error calculating energy" });
  }
});

/* ============================
   🔥 Start Server
   ============================ */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));