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
// 1. AI HỎI ĐÁP (Trả lời mọi thứ, TỪ CHỐI giả thuyết lịch sử)
// ==========================================
app.post('/ask', async (req, res) => {
    const { question, lang } = req.body;
    if (!question) return res.status(400).json({ reply: "Vui lòng cung cấp câu hỏi." });

    try {
        const systemPrompt = `Bạn là trợ lý AI thông minh đa năng. Bạn có thể trả lời kiến thức về mọi lĩnh vực (Toán, Khoa học, Lịch sử, Đời sống...). 
        QUY TẮC TUYỆT ĐỐI: NẾU người dùng hỏi về các giả thuyết lịch sử đi ngược sự thật (ví dụ: "Nếu như...", "Giả sử...", "Điều gì xảy ra nếu..."), BẠN KHÔNG ĐƯỢC TRẢ LỜI. Bạn BẮT BUỘC phải nói đúng nguyên văn câu này: "Để mô phỏng các giả thuyết thay đổi lịch sử, xin ngài hãy sử dụng tính năng Đa Vũ Trụ."
        Vui lòng trả lời bằng tiếng Việt (hoặc tiếng Anh nếu người dùng yêu cầu).`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }],
            temperature: 0.6,
        });
        res.json({ reply: response.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ reply: "Lỗi kết nối máy chủ AI." });
    }
});

// ==========================================
// 2. ĐA VŨ TRỤ (CHỈ nhận giả thuyết, TỪ CHỐI câu hỏi thường)
// ==========================================
app.post('/whatif', async (req, res) => {
    const { scenario } = req.body;
    if (!scenario) return res.status(400).json({ error: true, reply: "Vui lòng cung cấp giả thuyết." });

    try {
        const systemPrompt = `Bạn là Cỗ máy Đa Vũ Trụ lịch sử. 
        BƯỚC 1: Nếu người dùng hỏi các câu hỏi kiến thức thông thường (ví dụ: "1+1 bằng mấy", "Lê Hoàn sinh năm nào", "Thời tiết hôm nay"), BẠN PHẢI TỪ CHỐI và trả lời: "Tôi là hệ thống Đa vũ trụ, chỉ nhận mô phỏng các giả thuyết 'Nếu như...'. Để hỏi kiến thức thông thường, hãy dùng tính năng AI Hỏi Đáp."
        BƯỚC 2: Nếu đúng là một giả thuyết, hãy tính toán Tỉ lệ thành công (%), Thương vong (%). Phân tích ngắn gọn hậu quả.
        BẮT BUỘC TRẢ VỀ JSON:
        {
            "isError": false (đặt là true nếu là câu hỏi sai chủ đề ở Bước 1),
            "successRate": 0-100,
            "casualties": 0-100,
            "analysis": "Câu trả lời của bạn"
        }`;

        const chatResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: scenario }],
            temperature: 0.5,
            response_format: { type: "json_object" }
        });

        const aiData = JSON.parse(chatResponse.choices[0].message.content);

        if (aiData.isError) {
            return res.json({ successRate: 0, casualties: 0, reply: aiData.analysis, imageUrl: null });
        }

        // Vẽ ảnh minh họa
        let finalImageUrl = null;
        try {
            const imageResponse = await openai.images.generate({
                model: "dall-e-2", prompt: `Tranh cổ phong lịch sử Việt Nam u ám, thể hiện viễn cảnh: ${scenario}`, n: 1, size: "512x512",
            });
            finalImageUrl = imageResponse.data[0].url;
        } catch (e) { console.log("Hết hạn mức DALL-E"); }

        res.json({ successRate: aiData.successRate || 0, casualties: aiData.casualties || 0, reply: aiData.analysis, imageUrl: finalImageUrl });
    } catch (error) {
        res.status(500).json({ error: true, reply: "Lỗi hệ thống Đa vũ trụ." });
    }
});

// ==========================================
// 3. TRÒ CHƠI NHẬP VAI (ROLEPLAY)
// ==========================================
app.post('/roleplay', async (req, res) => {
    const { history, turn } = req.body; 
    // history là mảng chứa ngữ cảnh trò chuyện trước đó để AI nhớ mạch truyện

    try {
        const systemPrompt = `Bạn là Quản trò Game Nhập vai Lịch sử Tiền Lê. Người chơi đóng vai Hoàng đế Lê Hoàn. 
        Lượt hiện tại: ${turn} / 15.
        Dựa vào lịch sử trò chuyện, hãy đưa ra tình huống tiếp theo hoặc phản hồi lại lựa chọn của Hoàng đế. Tình huống phải do một NPC (tướng quân, thái giám, người đưa thư...) trình bày. Lời văn cổ trang, khẩn cấp.
        Nhiệm vụ của bạn:
        1. Viết lời thoại của NPC (ngắn gọn, tối đa 2-3 câu).
        2. Tạo ra đúng 4 lựa chọn hành động cho Hoàng đế.
        3. Đánh giá: Nếu người chơi đưa ra quyết định quá ngu ngốc làm mất nước/chết, hoặc đã tới lượt 15 và chiến thắng, hãy set isGameOver = true và giải thích lý do kết thúc.
        TRẢ VỀ ĐỊNH DẠNG JSON:
        {
            "npcDialogue": "Thưa bệ hạ, quân Tống đang...",
            "choices": ["Hành động A", "Hành động B", "Hành động C", "Hành động D"],
            "isGameOver": false,
            "endReason": ""
        }`;

        const messages = [{ role: "system", content: systemPrompt }, ...history];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            temperature: 0.7, // Tăng nhẹ để cốt truyện sáng tạo hơn
            response_format: { type: "json_object" }
        });

        res.json(JSON.parse(response.choices[0].message.content));
    } catch (error) {
        res.status(500).json({ error: true, npcDialogue: "Lỗi kết nối vũ trụ kịch bản." });
    }
});

// ==========================================
// 4. API TẠO GIỌNG NÓI (Cho phép chọn Giọng)
// ==========================================
app.post('/speak', async (req, res) => {
    const { text, voiceId } = req.body;
    // voiceId: 'onyx' (Giọng trầm ấm cho Vua Lê Hoàn), 'alloy' (Giọng trung tính cho NPC)
    const selectedVoice = voiceId || "onyx"; 

    if (!text) return res.status(400).send("Vui lòng cung cấp văn bản.");
    try {
        const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: selectedVoice, input: text });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        res.set('Content-Type', 'audio/mpeg'); res.send(buffer);
    } catch (error) { res.status(500).send("Lỗi tạo giọng nói."); }
});

app.listen(port, () => { console.log(`✅ Server Backend chạy tại http://localhost:${port}`); });