const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ==========================================
// 1. AI HỎI ĐÁP (Giữ nguyên)
// ==========================================
app.post('/ask', async (req, res) => {
    const { question, lang } = req.body;
    if (!question) return res.status(400).json({ reply: "Vui lòng cung cấp câu hỏi." });

    try {
        const systemPrompt = `Bạn là trợ lý AI thông minh. QUY TẮC TUYỆT ĐỐI: NẾU người dùng hỏi về giả thuyết lịch sử đi ngược sự thật ("Nếu như...", "Điều gì xảy ra nếu..."), KHÔNG ĐƯỢC TRẢ LỜI. Bạn BẮT BUỘC phải nói: "Để mô phỏng các giả thuyết thay đổi lịch sử, xin ngài hãy sử dụng tính năng Đa Vũ Trụ."`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }], temperature: 0.6,
        });
        res.json({ reply: response.choices[0].message.content });
    } catch (error) { res.status(500).json({ reply: "Lỗi kết nối máy chủ AI." }); }
});

// ==========================================
// 2. ĐA VŨ TRỤ (Có lọc rác JSON)
// ==========================================
app.post('/whatif', async (req, res) => {
    const { scenario } = req.body;
    if (!scenario) return res.status(400).json({ error: true, reply: "Vui lòng cung cấp giả thuyết." });

    try {
        const systemPrompt = `Bạn là Cỗ máy Đa Vũ Trụ. 
        Nếu câu hỏi không phải giả thuyết lịch sử, trả lời: "Tôi là hệ thống Đa vũ trụ, chỉ nhận mô phỏng các giả thuyết. Để hỏi kiến thức thường, hãy dùng AI Hỏi Đáp."
        BẮT BUỘC TRẢ VỀ CHUẨN JSON: { "isError": false, "successRate": 0, "casualties": 0, "analysis": "..." }`;

        const chatResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: scenario }],
            temperature: 0.5, response_format: { type: "json_object" }
        });

        // BỘ LỌC RÁC: Xóa các thẻ markdown sinh dư
        let cleanContent = chatResponse.choices[0].message.content.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const aiData = JSON.parse(cleanContent);

        if (aiData.isError) return res.json({ successRate: 0, casualties: 0, reply: aiData.analysis, imageUrl: null });

        let finalImageUrl = null;
        try {
            const imageResponse = await openai.images.generate({ model: "dall-e-2", prompt: `Tranh cổ phong lịch sử Việt Nam u ám: ${scenario}`, n: 1, size: "512x512" });
            finalImageUrl = imageResponse.data[0].url;
        } catch (e) { console.log("Lỗi vẽ ảnh"); }

        res.json({ successRate: aiData.successRate || 0, casualties: aiData.casualties || 0, reply: aiData.analysis, imageUrl: finalImageUrl });
    } catch (error) { res.status(500).json({ error: true, reply: "Lỗi hệ thống Đa vũ trụ." }); }
});

// ==========================================
// 3. TRÒ CHƠI NHẬP VAI (ROLEPLAY - Có lọc rác JSON)
// ==========================================
// ==========================================
// 3. TRÒ CHƠI NHẬP VAI (ROLEPLAY - Chống rác ký tự)
// ==========================================
app.post('/roleplay', async (req, res) => {
    const { history, turn } = req.body; 
    try {
        const systemPrompt = `Bạn là Quản trò Game Nhập vai Lịch sử Tiền Lê. Người chơi đóng vai Hoàng đế Lê Hoàn. Lượt hiện tại: ${turn} / 15.
        QUY TẮC TỐI THƯỢNG:
        1. Tạo ra đúng 4 lựa chọn hành động.
        2. Mảng "choices" CHỈ chứa nội dung hành động, TUYỆT ĐỐI KHÔNG chứa các ký tự như "A.", "B.", "1.", "2.", "-" ở đầu câu. (Ví dụ đúng: "Rút quân về Hoa Lư". Ví dụ sai: "A. Rút quân về Hoa Lư").
        
        TRẢ VỀ ĐỊNH DẠNG JSON CHUẨN: { "npcDialogue": "...", "choices": ["Hành động 1", "Hành động 2", "Hành động 3", "Hành động 4"], "isGameOver": false, "endReason": "" }`;

        const messages = [{ role: "system", content: systemPrompt }, ...history];
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", messages: messages, temperature: 0.7, response_format: { type: "json_object" }
        });

        let cleanContent = response.choices[0].message.content.replace(/```json/gi, '').replace(/```/gi, '').trim();
        res.json(JSON.parse(cleanContent));
    } catch (error) { res.status(500).json({ error: true, npcDialogue: "Lỗi kết nối vũ trụ kịch bản." }); }
});

// ==========================================
// 4. API TẠO GIỌNG NÓI
// ==========================================
app.post('/speak', async (req, res) => {
    const { text, voiceId } = req.body;
    const selectedVoice = voiceId || "onyx"; 
    if (!text) return res.status(400).send("Vui lòng cung cấp văn bản.");
    try {
        const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: selectedVoice, input: text });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        res.set('Content-Type', 'audio/mpeg'); res.send(buffer);
    } catch (error) { res.status(500).send("Lỗi tạo giọng nói."); }
});

app.listen(port, () => { console.log(`✅ Server Backend chạy tại http://localhost:${port}`); });