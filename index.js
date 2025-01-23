require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const UserSchema = new mongoose.Schema({
  lineId: String,
  hasPlayed: { type: Boolean, default: false },
  prize: { type: String, default: "ไม่ได้รางวัล" },
});

const User = mongoose.model("User", UserSchema);

const replyMessage = async (replyToken, messages) => {
  await axios.post("https://api.line.me/v2/bot/message/reply", {
    replyToken,
    messages,
  }, {
    headers: { "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
};

app.post("/webhook", async (req, res) => {
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
      const prizes = ["รางวัลที่ 1", "รางวัลที่ 2", "รางวัลที่ 3", "รางวัลที่ 4", "รางวัลที่ 5"];
      const noPrize = "ไม่ได้รางวัล";
      const prize = Math.random() < 0.5 ? prizes[Math.floor(Math.random() * prizes.length)] : noPrize;

      const newUser = new User({ lineId, hasPlayed: true, prize });
      await newUser.save();

      await replyMessage(event.replyToken, [{ type: "text", text: `🎉 คุณได้รับ: ${prize}` }]);
    }, 5000);
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
