const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   MONGODB CONNECTION
========================= */
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.log("❌ MONGO_URI is missing in environment variables");
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.log("❌ Mongo error:", err.message));
}

/* =========================
   SIMPLE MEMORY STORAGE (fallback if DB not used yet)
========================= */
let requests = [];

/* =========================
   ROUTES
========================= */

// Home route (fixes "Cannot GET /")
app.get("/", (req, res) => {
  res.send("✅ Server is running correctly");
});

// Receive webhook / requests
app.post("/webhook", (req, res) => {
  const data = {
    id: Date.now(),
    email: req.body.email || "no-email",
    note: req.body.note || "no-note",
    date: new Date()
  };

  requests.push(data);

  console.log("📩 New request:", data);

  res.json({ success: true, message: "Request received" });
});

// View requests (fixes your Cannot GET /requests issue)
app.get("/requests", (req, res) => {
  res.json(requests);
});

// Clear requests (optional admin tool)
app.delete("/requests", (req, res) => {
  requests = [];
  res.json({ success: true, message: "Cleared" });
});

/* =========================
   START SERVER (IMPORTANT FOR RAILWAY)
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
