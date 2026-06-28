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
// 1. AI HỎI ĐÁP
// ==========================================
app.post('/ask', async (req, res) => {
    const { question, lang } = req.body;
    if (!question) return res.status(400).json({ reply: "Vui lòng cung cấp câu hỏi." });

    try {
        const systemPrompt = `Bạn là trợ lý AI thông minh về lịch sử Lê Hoàn. 
        QUY TẮC: Từ chối các giả thuyết "Nếu như" và yêu cầu người dùng qua mục Đa vũ trụ.
        BẮT BUỘC TRẢ VỀ CHUẨN JSON VỚI ĐỊNH DẠNG:
        { "reply": "Câu trả lời của bạn", "suggestions": ["Gợi ý câu hỏi 1", "Gợi ý câu hỏi 2"] }`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }], 
            temperature: 0.5, response_format: { type: "json_object" }
        });

        let cleanContent = response.choices[0].message.content.replace(/```json/gi, '').replace(/```/gi, '').trim();
        res.json(JSON.parse(cleanContent));
    } catch (error) { res.status(500).json({ reply: "Lỗi kết nối máy chủ AI.", suggestions: ["Lê Hoàn lên ngôi năm nào?"] }); }
});

// ==========================================
// 2. ĐA VŨ TRỤ
// ==========================================
app.post('/whatif', async (req, res) => {
    const { history, scenario } = req.body;
    if (!scenario) return res.status(400).json({ error: true, reply: "Vui lòng cung cấp giả thuyết." });

    try {
        const systemPrompt = `Bạn là Cỗ máy Đa Vũ Trụ lịch sử Tiền Lê.
        BẮT BUỘC TRẢ VỀ CHUẨN JSON: 
        { "isError": false, "successRate": 0, "casualties": 0, "analysis": "Phân tích hậu quả...", "suggestions": ["Giả thuyết mở rộng 1", "Giả thuyết mở rộng 2"] }`;

        const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: scenario }];
        const chatResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini", messages: messages, temperature: 0.6, response_format: { type: "json_object" }
        });

        let cleanContent = chatResponse.choices[0].message.content.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const aiData = JSON.parse(cleanContent);

        if (aiData.isError) return res.json({ successRate: 0, casualties: 0, reply: aiData.analysis, suggestions: [], imageUrl: null });

        let finalImageUrl = null;
        if (history.length === 0) {
            try {
                const imageResponse = await openai.images.generate({ model: "dall-e-2", prompt: `Tranh cổ phong lịch sử Việt Nam u ám: ${scenario}`, n: 1, size: "512x512" });
                finalImageUrl = imageResponse.data[0].url;
            } catch (e) { console.log("Lỗi vẽ ảnh"); }
        }

        res.json({ successRate: aiData.successRate || 0, casualties: aiData.casualties || 0, reply: aiData.analysis, suggestions: aiData.suggestions || [], imageUrl: finalImageUrl });
    } catch (error) { res.status(500).json({ error: true, reply: "Lỗi hệ thống Đa vũ trụ." }); }
});

// ==========================================
// 3. TRÒ CHƠI NHẬP VAI
// ==========================================
app.post('/roleplay', async (req, res) => {
    const { history, turn } = req.body; 
    try {
        const systemPrompt = `Bạn là Quản trò Game Nhập vai Lịch sử. Người chơi là Hoàng đế Lê Hoàn. Lượt hiện tại: ${turn} / 15.
        TRẢ VỀ ĐỊNH DẠNG JSON CHUẨN: { "npcDialogue": "...", "choices": ["Hành động 1", "Hành động 2", "Hành động 3", "Hành động 4"], "isGameOver": false, "endReason": "Khen/Chê" }`;

        const messages = [{ role: "system", content: systemPrompt }, ...history];
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", messages: messages, temperature: 0.7, response_format: { type: "json_object" }
        });

        let cleanContent = response.choices[0].message.content.replace(/```json/gi, '').replace(/```/gi, '').trim();
        res.json(JSON.parse(cleanContent));
    } catch (error) { res.status(500).json({ error: true, npcDialogue: "Lỗi kết nối." }); }
});

// ==========================================
// 4. ÂM THANH (TTS)
// ==========================================
app.post('/speak', async (req, res) => {
    const { text, voiceId } = req.body;
    const selectedVoice = voiceId || "onyx"; 
    if (!text) return res.status(400).send("Lỗi");
    try {
        const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: selectedVoice, input: text });
        res.set('Content-Type', 'audio/mpeg'); res.send(Buffer.from(await mp3.arrayBuffer()));
    } catch (error) { res.status(500).send("Lỗi tạo giọng nói."); }
});

// ==========================================
// 5. LƯU BÁO CÁO VỀ GOOGLE SHEETS
// ==========================================
app.post('/save-report', async (req, res) => {
    const { playerName, history, type } = req.body;
    
    // BẠN DÁN LINK "WEB APP URL" (https://script.google.com/...) VÀO GIỮA 2 DẤU NGOẶC KÉP Ở DÒNG DƯỚI ĐÂY NHÉ:
    const GOOGLE_SHEET_URL = "Dhttps://docs.google.com/spreadsheets/d/1rLF3ZuX6d2uwcdzHu19W3uCqa23Cz064qmcMODPMpEk/edit";

    try {
        if (GOOGLE_SHEET_URL === "https://docs.google.com/spreadsheets/d/1rLF3ZuX6d2uwcdzHu19W3uCqa23Cz064qmcMODPMpEk/edit") {
            console.log(`[CẢNH BÁO] Bạn chưa dán link Web App. Dữ liệu: ${playerName}`);
            return res.json({ success: true, message: "Chưa cấu hình Google Sheet URL." });
        }

        const fetchResponse = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify({ playerName, history, type }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        const text = await fetchResponse.text();
        console.log(`Đã gửi báo cáo về Sheet: ${playerName} - ${type}`);
        res.json({ success: true });
    } catch (error) { 
        console.error("Lỗi khi gửi sang Google Sheets:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống lưu báo cáo." }); 
    }
});

app.listen(port, () => { console.log(`✅ Server Backend chạy tại http://localhost:${port}`); });