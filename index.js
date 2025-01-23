require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const crypto = require("crypto"); // สำหรับคำนวณ signature

const app = express();
app.use(express.json());

// เชื่อมต่อ MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// สร้าง Schema สำหรับ User
const UserSchema = new mongoose.Schema({
  lineId: String,
  hasPlayed: { type: Boolean, default: false },
  prize: { type: String, default: "ไม่ได้รางวัล" },
});

const User = mongoose.model("User", UserSchema);

// ฟังก์ชันในการตอบกลับข้อความไปยัง LINE
const replyMessage = async (replyToken, messages) => {
  await axios.post("https://api.line.me/v2/bot/message/reply", {
    replyToken,
    messages,
  }, {
    headers: { "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
};

// 🎯 ฟังก์ชันสุ่มรางวัลแบบถ่วงน้ำหนัก
const getRandomPrize = () => {
  const prizes = [
    { name: "🎉 รางวัลที่ 1 (ทองคำ)", weight: 1 },
    { name: "🎊 รางวัลที่ 2 (iPhone 15)", weight: 2 },
    { name: "🎁 รางวัลที่ 3 (iPad)", weight: 3 },
    { name: "🎮 รางวัลที่ 4 (PS5)", weight: 4 },
    { name: "🎧 รางวัลที่ 5 (AirPods)", weight: 5 },
    { name: "👜 รางวัลที่ 6 (กระเป๋าแบรนด์เนม)", weight: 6 },
    { name: "🎟️ รางวัลที่ 7 (Gift Voucher 1000 บาท)", weight: 7 },
    { name: "🍽️ รางวัลที่ 8 (บัตรรับประทานอาหารฟรี)", weight: 8 },
    { name: "☕ รางวัลที่ 9 (บัตร Starbucks 500 บาท)", weight: 9 },
    { name: "😢 ไม่ได้รับรางวัล", weight: 55 },
  ];

  const weightedArray = prizes.flatMap((prize) => Array(prize.weight).fill(prize.name));
  return weightedArray[Math.floor(Math.random() * weightedArray.length)];
};

// ฟังก์ชันตรวจสอบ signature จาก LINE API
const verifySignature = (req) => {
  const signature = req.headers["x-line-signature"]; // รับ signature จาก header
  const body = JSON.stringify(req.body); // รับ request body

  const hash = crypto
    .createHmac("sha256", process.env.LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");

  return signature === hash; // เปรียบเทียบ signature ที่ LINE ส่งมาพร้อมกับที่คำนวณ
};

// Webhook endpoint
app.post("/webhook", async (req, res) => {
  // ตรวจสอบว่า request มาจาก LINE จริงหรือไม่
  if (!verifySignature(req)) {
    return res.status(400).send("Invalid signature");
  }

  const event = req.body.events[0];

  if (event.type === "follow") {
    await replyMessage(event.replyToken, [{ type: "text", text: "🎉 ยินดีต้อนรับ! กดปุ่มด้านล่างเพื่อเล่น Lucky Draw" }]);
  }

  if (event.type === "message" && event.message.text === "ลุ้นโชค") {
    const lineId = event.source.userId;
    const existingUser = await User.findOne({ lineId });

    if (existingUser) {
      return replyMessage(event.replyToken, [{ type: "text", text: `คุณเคยเล่นไปแล้ว! คุณได้รับ: ${existingUser.prize}` }]);
    }

    // 🎬 ส่งข้อความ Countdown
    await replyMessage(event.replyToken, [{
      type: "text",
      text: "🎲 กำลังสุ่มรางวัล... กรุณารอสักครู่ ⏳"
    }]);

    // ⏳ รอ 5 วินาทีก่อนแจ้งผล
    setTimeout(async () => {
      const prize = getRandomPrize();

      const newUser = new User({ lineId, hasPlayed: true, prize });
      await newUser.save();

      await replyMessage(event.replyToken, [{ type: "text", text: `🎉 คุณได้รับ: ${prize}` }]);
    }, 5000);
  }

  res.sendStatus(200);
});

// เริ่มเซิร์ฟเวอร์
if (require.main === module) {
  app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
  });
}

// สำหรับ Vercel
module.exports = app;

