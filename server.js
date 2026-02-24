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
    origin: "http://localhost:5173", // Vite default
    methods: ["GET", "POST"]
  }
});

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");

    // 🔥 Change Stream
    const changeStream = SolarReading.watch();

    changeStream.on("change", (change) => {
      if (change.operationType === "insert") {
        console.log("New Solar Data Inserted");

        io.emit("new-solar-data", change.fullDocument);
      }
    });

  })
  .catch(err => console.error("MongoDB Connection Error:", err));

// API route
app.get("/api/solar-readings", async (req, res) => {
  try {
    const readings = await SolarReading.find().sort({ timestamp: 1 });
    res.json(readings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching solar data" });
  }
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});