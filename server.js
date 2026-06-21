const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

// ✅ SERVE STATIC FILES (YOUR DASHBOARD)
app.use(express.static("public"));

// =========================
// MONGO CONNECT (SAFE)
// =========================
if (!process.env.MONGO_URI) {
  console.log("❌ MONGO_URI missing");
} else {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log("Mongo error:", err.message));
}

// =========================
// DATABASE
// =========================
const Request = mongoose.model("Request", new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  note: String,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
}));

function makeId() {
  return "REQ-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// =========================
// EMAIL
// =========================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// =========================
// DISCORD
// =========================
async function sendDiscord(data) {
  try {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📩 New Request\nName: ${data.name}\nEmail: ${data.email}\nNote: ${data.note}\nID: ${data.id}`
      })
    });
  } catch (e) {
    console.log("discord fail", e.message);
  }
}

// =========================
// WEBHOOK
// =========================
app.post("/webhook", async (req, res) => {
  const data = req.body;

  const saved = await Request.create({
    id: makeId(),
    name: data.name || "unknown",
    email: data.email,
    note: data.note || "",
    status: "pending"
  });

  await sendDiscord(saved);

  res.json({ ok: true });
});

// =========================
// GET REQUESTS (DASHBOARD DATA)
// =========================
app.get("/requests", async (req, res) => {
  res.json(await Request.find().sort({ _id: -1 }));
});

// =========================
// COMPLETE + EMAIL + DISCORD
// =========================
app.post("/complete/:id", async (req, res) => {
  const r = await Request.findOne({ id: req.params.id });

  if (!r) return res.json({ error: "not found" });

  r.status = "completed";
  await r.save();

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: r.email,
    subject: "Request Completed",
    text: `Hello ${r.name}, your request ${r.id} is completed.`
  });

  await sendDiscord({
    name: r.name,
    email: r.email,
    note: "COMPLETED",
    id: r.id
  });

  res.json({ ok: true });
});

// =========================
// HOME PAGE → YOUR HTML DASHBOARD
// =========================
// IMPORTANT: THIS FIXES "Cannot GET /"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// =========================
// START SERVER (RAILWAY SAFE)
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("RUNNING 24/7 READY ON PORT", PORT);
});
