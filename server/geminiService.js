const getApiKey = () => process.env.GOOGLE_API_KEY;
const SYSTEM_PROMPT = `
أنت "المساعد الذكي للكويت للسفريات"، موظف خدمة عملاء متميز.

⚠️ تنبيه هام: يجب أن يكون ردك باللغة العربية فقط. ممنوع استخدام أي لغة أخرى.

معلومات الشركة:
- الهاتف: 776358963
- واتساب: 967776358963
- العنوان: صنعاء - الستين الشمالي

خدماتنا:
1. الحج والعمرة.
2. حجوزات الطيران.
3. التأشيرات.
4. استخراج الجوازات.

قواعد الرد:
1. كن ودوداً ومختصراً (رد مناسب للنطق الصوتي).
2. لا تذكر أنك ذكاء اصطناعي.
3. إذا كان السؤال خارج نطاق السياحة، اعتذر بلطف.
`;

export const geminiService = {
    async generateResponseStream(userMessage, context = []) {
        try {
            // Gemini requires alternating User/Model turns.
            // We combine context and current message.
            let formattedHistory = context.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            // Filter out system messages from history if any (just in case)
            formattedHistory = formattedHistory.filter(msg => msg.role === 'user' || msg.role === 'model');

            // Ensure history starts with User if strictly required, but usually OK if System Instruction is separate.
            // However, consecutive messages of same role are not allowed.
            // We need to merge consecutive messages of same role.
            const mergedHistory = [];
            for (const msg of formattedHistory) {
                if (mergedHistory.length > 0 && mergedHistory[mergedHistory.length - 1].role === msg.role) {
                    // Merge text
                    mergedHistory[mergedHistory.length - 1].parts[0].text += "\n" + msg.parts[0].text;
                } else {
                    mergedHistory.push(msg);
                }
            }

            // Add current user message
            if (mergedHistory.length > 0 && mergedHistory[mergedHistory.length - 1].role === 'user') {
                mergedHistory[mergedHistory.length - 1].parts[0].text += "\n" + userMessage;
            } else {
                mergedHistory.push({
                    role: "user",
                    parts: [{ text: userMessage }]
                });
            }

            const payload = {
                system_instruction: {
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                contents: mergedHistory
            };

            console.log("🚀 Sending Payload to Gemini:", JSON.stringify(payload, null, 2));

            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error('Google API key is not configured. Please set GOOGLE_API_KEY in your environment variables.');
            }

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.text();
                console.error(`❌ Gemini API Error Details: Status ${response.status}`, err);
                throw new Error(`Gemini API error: ${response.status} - ${err}`);
            }

            return response.body;
        } catch (error) {
            console.error('Gemini Service Error (Catch Block):', error);
            throw error;
        }
    }
};
