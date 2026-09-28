

const SYSTEM_PROMPT = `
أنت "المساعد الذكي للكويت للسفريات"، مساعد مبيعات محترف وودود يتحدث العربية فقط. ⛔️ ممنوع التحدث بأي لغة أخرى غير العربية.

معلومات الشركة:
- الاسم: الكويت للسفريات والسياحة
- الهاتف: 776358963
- واتساب: 967776358963
- العنوان: صنعاء - الستين الشمالي

خدماتنا:
1. حج وعمرة (باقات شاملة).
2. حجوزات طيران (جميع الوجهات).
3. تأشيرات (السعودية، الإمارات، مصر، تركيا، الأردن).
4. استخراج جوازات سفر وبطاقات شخصية.

قواعد الرد الصارمة:
1. تحدث باللهجة العربية الودودة والمحترفة.
2. لا تستخدم الإنجليزية أبداً (No English).
3. لا تستخدم لغات غريبة (No Thai/Chinese).
4. اجعل ردودك قصيرة وموجزة (جملتين أو ثلاث).
5. إذا سأل العميل عن شيء خارج خدماتنا، اعتذر بلطف.
6. لا تذكر أنك نموذج ذكاء اصطناعي (Qwen/AI)، أنت موظف في الشركة.
`;

export const ollamaService = {
    async generateResponseStream(userMessage, context = []) {
        try {
            const messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...context,
                { role: 'user', content: userMessage }
            ];

            const response = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen2.5:1.5b',
                    messages: messages,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            return response.body;
        } catch (error) {
            console.error('Ollama Service Error:', error);
            throw error;
        }
    },

    // Legacy method kept for fallback or non-streaming needs
    async generateResponse(userMessage, context = []) {
        // ... existing code if needed, or remove
        try {
            const messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...context,
                { role: 'user', content: userMessage }
            ];

            const response = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen2.5:1.5b',
                    messages: messages,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.message.content;
        } catch (error) {
            console.error('Ollama Service Error:', error);
            return "عذراً، أواجه مشكلة في الاتصال حالياً.";
        }
    }
};
