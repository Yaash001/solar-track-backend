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
    methods: ["GET", "POST"]
  }
});

// ✅ Connect MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
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
  .catch(err => console.error("MongoDB Connection Error:", err));

/* ============================
   📡 API ROUTES FOR DASHBOARD
   ============================ */

// ✅ Get all readings (sorted by time)
app.get("/api/solar-readings", async (req, res) => {
  try {
    const readings = await SolarReading
      .find()
      .sort({ recordedAt: 1 });

    res.json(readings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching solar data" });
  }
});

// ✅ Get today’s data only
app.get("/api/solar-readings/today", async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const readings = await SolarReading.find({
      recordedAt: { $gte: start, $lte: end }
    }).sort({ recordedAt: 1 });

    res.json(readings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching today's data" });
  }
});

// ✅ Get latest reading
app.get("/api/solar-readings/latest", async (req, res) => {
  try {
    const latest = await SolarReading
      .findOne()
      .sort({ recordedAt: -1 });

    res.json(latest);
  } catch (error) {
    res.status(500).json({ message: "Error fetching latest data" });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});