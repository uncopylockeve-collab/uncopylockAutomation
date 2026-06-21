
const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB connected"));

// DATABASE
const Request = mongoose.model("Request", new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  note: String,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
}));

function makeId(){
  return "REQ-" + Math.random().toString(36).substring(2,10).toUpperCase();
}

// EMAIL
const transporter = nodemailer.createTransport({
  service:"gmail",
  auth:{
    user:process.env.EMAIL_USER,
    pass:process.env.EMAIL_PASS
  }
});

// DISCORD SYNC
async function sendDiscord(data){
  try{
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        content: `📩 New Request\nName: ${data.name}\nEmail: ${data.email}\nNote: ${data.note}\nID: ${data.id}`
      })
    });
  }catch(e){
    console.log("discord fail", e.message);
  }
}

// WEBHOOK ENTRY
app.post("/webhook", async (req,res)=>{
  const data = req.body;

  const saved = await Request.create({
    id: makeId(),
    name: data.name || "unknown",
    email: data.email,
    note: data.note || "",
    status: "pending"
  });

  // SYNC BOTH SYSTEMS
  await sendDiscord(saved);

  res.json({ok:true});
});

// DASHBOARD
app.get("/requests", async (req,res)=>{
  res.json(await Request.find().sort({_id:-1}));
});

// COMPLETE + EMAIL + DISCORD UPDATE
app.post("/complete/:id", async (req,res)=>{
  const r = await Request.findOne({id:req.params.id});
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
    note: "STATUS UPDATED: COMPLETED",
    id: r.id
  });

  res.json({ok:true});
});

// AUTO WORKER (backup safety)
setInterval(async ()=>{
  const pending = await Request.find({status:"pending"});
  for(const r of pending){
    if(!r.email) continue;
    try{
      await transporter.sendMail({
        from:process.env.EMAIL_USER,
        to:r.email,
        subject:"We received your request",
        text:`Hi ${r.name}, we received ${r.id}`
      });
      r.status="emailed";
      await r.save();
    }catch(e){}
  }
},15000);

app.listen(3000, ()=>console.log("RUNNING 24/7 READY"));
