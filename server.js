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
// 2. ĐA VŨ TRỤ (Hỗ trợ Chat liên tục & Tính tỷ lệ thực tế)
// ==========================================
app.post('/whatif', async (req, res) => {
    const { history, scenario } = req.body;
    if (!scenario) return res.status(400).json({ error: true, reply: "Vui lòng cung cấp giả thuyết." });

    try {
        const systemPrompt = `Bạn là Cỗ máy Đa Vũ Trụ lịch sử thời Tiền Lê.
        QUY TẮC:
        1. Người dùng sẽ đưa ra giả thuyết hoặc đặt câu hỏi đào sâu về giả thuyết đang diễn ra. Từ chối trả lời kiến thức thông thường.
        2. Tỉ lệ thương vong và thành công phải RẤT THỰC TẾ dựa vào chiến thuật (VD: bị phục kích thương vong 80-100%, thắng lớn thương vong 5-15%).
        3. Cuối phần phân tích, HÃY GỢI Ý thêm 1 giả thuyết mở rộng để người dùng hỏi tiếp.
        BẮT BUỘC TRẢ VỀ CHUẨN JSON: { "isError": false, "successRate": 0, "casualties": 0, "analysis": "..." }`;

        const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: scenario }];

        const chatResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini", messages: messages,
            temperature: 0.6, response_format: { type: "json_object" }
        });

        let cleanContent = chatResponse.choices[0].message.content.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const aiData = JSON.parse(cleanContent);

        if (aiData.isError) return res.json({ successRate: 0, casualties: 0, reply: aiData.analysis, imageUrl: null });

        // Chỉ vẽ ảnh nếu là câu hỏi khởi đầu (lịch sử rỗng), câu hỏi đào sâu không cần vẽ lại để tiết kiệm tốc độ
        let finalImageUrl = null;
        if (history.length === 0) {
            try {
                const imageResponse = await openai.images.generate({ model: "dall-e-2", prompt: `Tranh cổ phong lịch sử Việt Nam u ám, hào hùng: ${scenario}`, n: 1, size: "512x512" });
                finalImageUrl = imageResponse.data[0].url;
            } catch (e) { console.log("Lỗi vẽ ảnh (Hết credit hoặc từ chối)"); }
        }

        res.json({ successRate: aiData.successRate || 0, casualties: aiData.casualties || 0, reply: aiData.analysis, imageUrl: finalImageUrl });
    } catch (error) { res.status(500).json({ error: true, reply: "Lỗi hệ thống Đa vũ trụ." }); }
});

// ==========================================
// 3. TRÒ CHƠI NHẬP VAI (ROLEPLAY - Khen/Chê thực tế)
// ==========================================
app.post('/roleplay', async (req, res) => {
    const { history, turn } = req.body; 
    try {
        const systemPrompt = `Bạn là Quản trò Game Nhập vai Lịch sử. Người chơi là Hoàng đế Lê Hoàn. Lượt hiện tại: ${turn} / 15.
        QUY TẮC:
        1. Tạo ra đúng 4 lựa chọn (chỉ chữ hành động, TUYỆT ĐỐI không có A,B,C,1,2,3).
        2. NẾU LƯỢT > 15 HOẶC MẤT NƯỚC/BỊ GIẾT: Đặt isGameOver = true. 
        3. MỤC endReason: Rất quan trọng! Nếu người chơi thắng, hãy viết lời Tuyên Dương nức nở tư duy quân sự của họ. Nếu thua, hãy Phê Bình gắt gao, chỉ rõ sai lầm chết người nào đã làm mất Đại Cồ Việt.
        TRẢ VỀ ĐỊNH DẠNG JSON CHUẨN: { "npcDialogue": "...", "choices": ["Hành động 1", "Hành động 2", "Hành động 3", "Hành động 4"], "isGameOver": false, "endReason": "Khen/Chê chi tiết" }`;

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