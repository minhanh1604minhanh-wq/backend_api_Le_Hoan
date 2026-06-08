const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Khởi tạo OpenAI với API Key từ file .env
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// API 1: Xử lý câu hỏi văn bản về Đại tướng Võ Nguyên Giáp
app.post('/ask', async (req, res) => {
    const { question, lang } = req.body;

    if (!question) {
        return res.status(400).json({ reply: "Vui lòng cung cấp câu hỏi." });
    }

    try {
        // Cấu hình prompt hệ thống (System Prompt) cho OpenAI về Đại tướng Võ Nguyên Giáp
        const languageRequirement = lang === 'en' ? 'Please reply in English.' : 'Vui lòng trả lời bằng Tiếng Việt.';
        const systemPrompt = `Bạn là một chuyên gia lịch sử am hiểu sâu sắc về Đại tướng Võ Nguyên Giáp - vị tướng vĩ đại của Quân đội nhân dân Việt Nam, người anh hùng dân tộc với những chiến công lẫy lừng, đặc biệt là chiến thắng lịch sử Điện Biên Phủ năm 1954. ${languageRequirement} Hãy dựa vào kiến thức lịch sử chính xác để trả lời người dùng một cách trang trọng, ngắn gọn, súc tích và mạch lạc.`;

        // Gọi API ChatGPT
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: question }
            ],
            temperature: 0.6,
        });

        // Trích xuất văn bản trả về
        const text = response.choices[0].message.content;

        // Trả kết quả về cho Frontend
        res.json({ reply: text });

    } catch (error) {
        console.error("Lỗi từ OpenAI API (Chat):", error);
        
        if (error.status === 429) {
            res.status(429).json({ reply: "Hệ thống AI đang quá tải hoặc tài khoản đã hết giới hạn (Quota). Vui lòng kiểm tra lại cấu hình tài khoản OpenAI." });
        } else {
            res.status(500).json({ reply: "Lỗi kết nối đến OpenAI. Vui lòng kiểm tra lại API Key hoặc mạng máy chủ." });
        }
    }
});

// API 2: Xử lý chuyển đổi văn bản thành giọng nói (TTS)
app.post('/speak', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).send("Vui lòng cung cấp văn bản để đọc.");
    }

    try {
        // Gọi API Text-to-Speech của OpenAI
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy", // Giọng đọc mẫu: alloy (hoặc có thể chọn echo, fable, onyx, nova, shimmer)
            input: text,
        });
        
        // Chuyển đổi dữ liệu âm thanh và gửi về Frontend
        const buffer = Buffer.from(await mp3.arrayBuffer());
        res.set('Content-Type', 'audio/mpeg');
        res.send(buffer);
        
    } catch (error) {
        console.error("Lỗi từ OpenAI API (TTS):", error);
        res.status(500).send("Lỗi tạo giọng nói từ máy chủ.");
    }
});

app.listen(port, () => {
    console.log(`✅ Server Backend Đại tướng Võ Nguyên Giáp đang chạy thành công tại http://localhost:${port}`);
});