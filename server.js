const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// API 1: AI Hỏi Đáp thông thường (Giữ nguyên)
app.post('/ask', async (req, res) => {
    const { question, lang } = req.body;
    if (!question) return res.status(400).json({ reply: "Vui lòng cung cấp câu hỏi." });

    try {
        const languageRequirement = lang === 'en' ? 'Please reply in English.' : 'Vui lòng trả lời bằng Tiếng Việt.';
        const systemPrompt = `Bạn là Hoàng đế Lê Hoàn (Lê Đại Hành). QUY TẮC BẢO MẬT: CHỈ trả lời lịch sử thời Tiền Lê. Nếu hỏi ngoài lề, từ chối: "Tôi không hiểu bạn đang cần điều gì? Hãy hỏi tôi về lịch sử mà bạn muốn biết về tôi, mọi thứ tôi đều sẽ trả lời." ${languageRequirement}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
            temperature: 0.2,
        });
        res.json({ reply: response.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ reply: "Lỗi kết nối máy chủ AI." });
    }
});

// API 2: ĐA VŨ TRỤ - Ép trả về TỈ LỆ %
app.post('/whatif', async (req, res) => {
    const { scenario } = req.body;
    if (!scenario) return res.status(400).json({ error: true, reply: "Vui lòng cung cấp giả thuyết." });

    try {
        const systemPrompt = `Bạn là cỗ máy Siêu Trí Tuệ phân tích lịch sử thời Tiền Lê - Lê Hoàn. Người dùng đưa ra giả thuyết "Nếu như...".
        Nếu sai chủ đề hoặc phá hoại, trả lời: "Giả thuyết này không hợp lệ."
        Nếu hợp lệ, hãy tính toán Tỉ lệ thành công (%) và Mức độ thương vong/Tổn thất (%) nếu giả thuyết đó xảy ra. Sau đó viết phân tích ngắn gọn (Viễn cảnh, Sự thật, Bài học).
        BẮT BUỘC TRẢ VỀ CHUẨN JSON VỚI ĐỊNH DẠNG:
        {
            "successRate": [một con số từ 0 đến 100],
            "casualties": [một con số từ 0 đến 100],
            "analysis": "[Đoạn văn bản phân tích]"
        }`;

        const chatResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: scenario }],
            temperature: 0.5,
            response_format: { type: "json_object" } // Ép GPT trả về định dạng JSON
        });

        const aiData = JSON.parse(chatResponse.choices[0].message.content);

        // Vẽ ảnh (Nếu hết hạn mức ảnh thì bắt lỗi, vẫn trả về JSON chữ)
        let finalImageUrl = null;
        try {
            const imageResponse = await openai.images.generate({
                model: "dall-e-2",
                prompt: `Tranh cổ phong lịch sử Việt Nam u ám, thể hiện viễn cảnh: ${scenario}`,
                n: 1, size: "512x512",
            });
            finalImageUrl = imageResponse.data[0].url;
        } catch (imgError) {
            console.log("Không thể vẽ ảnh (Hết credit dalee):", imgError.message);
        }

        res.json({ 
            successRate: aiData.successRate || 0,
            casualties: aiData.casualties || 0,
            reply: aiData.analysis || "Có lỗi phân tích.", 
            imageUrl: finalImageUrl 
        });

    } catch (error) {
        console.error("Lỗi WhatIf:", error);
        res.status(500).json({ error: true, reply: "Hệ thống giả lập đang quá tải, vui lòng thử lại sau." });
    }
});

// API 3: Text to Speech
app.post('/speak', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).send("Vui lòng cung cấp văn bản.");
    try {
        const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: "onyx", input: text });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        res.set('Content-Type', 'audio/mpeg'); res.send(buffer);
    } catch (error) { res.status(500).send("Lỗi tạo giọng nói."); }
});

app.listen(port, () => { console.log(`✅ Server Backend chạy tại http://localhost:${port}`); });