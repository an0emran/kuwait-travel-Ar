import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const COMPANY_INFO = {
    name: "الكويت للسفريات والسياحة",
    phone: "776358963",
    whatsapp: "967776358963",
    email: "alkuwaitagency2019@gmail.com",
    address: "صنعاء - الستين الشمالي",
    services: [
        "حج وعمرة - باقات شاملة وميسرة تتضمن التأشيرة والفندق والنقل",
        "حجوزات طيران - لجميع الوجهات العالمية بأفضل الأسعار (اليمنية، السعودية، القطرية، إلخ)",
        "تأشيرات - تخليص سريع ومضمون (السعودية، الإمارات، مصر، الأردن، تركيا، عمان)",
        "جوازات سفر - خدمات استخراج وتجديد جوازات السفر",
        "بطاقات شخصية - خدمة استخراج البطاقات الشخصية"
    ],
    workingHours: "24 ساعة دعم فني مباشر"
};

class AIService {
    constructor() {
        this.initializeProviders();
    }

    initializeProviders() {
        this.providers = {};

        // Initialize Gemini
        if (process.env.GOOGLE_API_KEY) {
            try {
                this.providers.gemini = new ChatGoogleGenerativeAI({
                    apiKey: process.env.GOOGLE_API_KEY,
                    model: "gemini-1.5-flash",
                    modelName: "gemini-1.5-flash",
                    maxOutputTokens: 500,
                });
                console.log("✅ Gemini Provider initialized");
            } catch (err) {
                console.error("Failed to initialize Gemini Provider:", err.message);
            }
        }

        // Initialize OpenAI
        if (process.env.OPENAI_API_KEY) {
            this.providers.openai = new ChatOpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                modelName: "gpt-3.5-turbo",
            });
            console.log("✅ OpenAI Provider initialized");
        }

        // Initialize Anthropic
        if (process.env.ANTHROPIC_API_KEY) {
            this.providers.claude = new ChatAnthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
                modelName: "claude-3-haiku-20240307",
            });
            console.log("✅ Claude Provider initialized");
        }
        // Initialize Custom API (IP based like Ollama or private cloud)
        if (process.env.AI_API_KEY && process.env.AI_API_URL) {
            this.providers.custom = new ChatOpenAI({
                apiKey: process.env.AI_API_KEY,
                configuration: {
                    baseURL: process.env.AI_API_URL,
                },
                modelName: process.env.AI_MODEL || "gpt-3.5-turbo",
            });
            console.log(`✅ Custom AI Provider (${process.env.AI_API_URL}) initialized`);
        }
    }

    getAvailableProviders() {
        return {
            gemini: !!this.providers.gemini,
            openai: !!this.providers.openai,
            claude: !!this.providers.claude,
            custom: !!this.providers.custom,
            mock: true
        };
    }

    async generate(text, providerName = 'auto', systemPromptInput = "", context = "", apiKey = null, knowledgeBase = "") {
        // Build System Prompt
        const systemPrompt = `أنت "مساعد الكويت للسفريات" الذكي والودود. 🌟
تحدث بلهجة طبيعية ومرحة، وكأنك خبير سياحي محترف يتحدث مع صديق.

معلومات الشركة:
- الهاتف: ${COMPANY_INFO.phone}
- واتساب: ${COMPANY_INFO.whatsapp}
- العنوان: ${COMPANY_INFO.address}
- الخدمات: ${COMPANY_INFO.services.join('، ')}
- ساعات العمل: ${COMPANY_INFO.workingHours}

قاعدة المعرفة من الملفات (Knowledge Base):
${knowledgeBase ? knowledgeBase : "لا توجد معلومات إضافية من الملفات."}

سياق المحادثة السابقة:
${context ? context : "لا يوجد سياق سابق"}

قواعد الرد:
1. استناداً إلى "قاعدة المعرفة"، أجب على أسئلة المستخدم بدقة.
2. كن ودوداً ومختصراً. الإجابات القصيرة أفضل للنطق الصوتي.
3. استخدم العربية الفصحى البسيطة أو البيضاء المفهومة للجميع.
4. إذا سأل العميل عن "كم السعر" أو "تفاصيل"، اعتمد على السياق السابق أو قاعدة المعرفة.
5. عندما يطلب حجزاً أو خدمة، وجهه بلطف أو استخدم الأوامر (Actions).
6. ممنوع ذكر أنك ذكاء اصطناعي، أنت موظف خدمة عملاء متميز.

هام جداً - تنفيذ الأوامر:
إذا طلب المستخدم إجراء معين (مثل حجز، تواصل، عروض)، يجب أن يكون ردك بصيغة JSON فقط كالتالي:
\`\`\`json
{
  "text": "الرد الصوتي الذي ستقوله للمستخدم",
  "action": {
    "type": "open_modal" | "navigate" | "scroll",
    "target": "اسم الخدمة للحجز" | "رابط الصفحة" | "id القسم"
  }
}
\`\`\`

أمثلة للأوامر:
- طلب حجز عمرة: "action": { "type": "open_modal", "target": "باقة العمرة" }
- طلب حجز طيران: "action": { "type": "open_modal", "target": "حجوزات طيران" }
- طلب تواصل: "action": { "type": "scroll", "target": "contact" }
- طلب عروض: "action": { "type": "scroll", "target": "offers" }

إذا كان مجرد استفسار عادي، رد بنص عادي فقط بدون JSON.

${systemPromptInput}`;

        let provider = null;

        // Dynamic Provider Creation (If Key Provided)
        if (apiKey) {
            // ... existing provider creation ...
            try {
                if (apiKey.startsWith("AIza")) { // Google Gemini Key
                    provider = new ChatGoogleGenerativeAI({
                        apiKey: apiKey,
                        model: "gemini-1.5-flash",
                        modelName: "gemini-1.5-flash",
                        maxOutputTokens: 500,
                    });
                } else if (apiKey.startsWith("sk-")) { // OpenAI Key
                    provider = new ChatOpenAI({
                        apiKey: apiKey,
                        modelName: "gpt-3.5-turbo",
                    });
                }
            } catch (e) {
                console.error("Failed to create dynamic provider:", e);
            }
        }

        // Fallback to static providers if no dynamic provider
        if (!provider) {
            provider = this.providers[providerName];
            if (!provider && providerName === 'auto') {
                provider = this.providers.custom || this.providers.gemini || this.providers.openai || this.providers.claude;
            }
        }

        // Use Provider if available
        if (provider) {
            try {
                const response = await provider.invoke([
                    new SystemMessage(systemPrompt),
                    new HumanMessage(text)
                ]);

                let content = response.content;

                // Try to parse JSON action
                try {
                    // Extract JSON if wrapped in markdown code blocks
                    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/{[\s\S]*}/);
                    if (jsonMatch) {
                        const jsonStr = jsonMatch[1] || jsonMatch[0];
                        const parsed = JSON.parse(jsonStr);
                        return parsed; // Return Object { text, action }
                    }
                } catch (e) {
                    console.log('Failed to parse AI JSON action, returning text only');
                }

                return { text: content }; // Normalize to object
            } catch (err) {
                console.error(`AI Provider Error:`, err.message);
                // Fallback to mock on error
            }
        }

        // Smart Mock Response Logic (NLP-lite)
        return { text: this.generateMockResponse(text) }; // Normalize mock response
    }

    generateMockResponse(text) {
        const q = text.toLowerCase();

        if (q.includes('مرحبا') || q.includes('السلام') || q.includes('اهلا')) {
            return `مرحباً بك في ${COMPANY_INFO.name}! كيف يمكنني مساعدتك اليوم في خدمات السفر والحج؟`;
        }
        if (q.includes('خدمات') || q.includes('تقدم')) {
            return `نقدم خدمات: ${COMPANY_INFO.services.join('، ')}. أي خدمة ترغب بمعرفة تفاصيلها؟`;
        }
        if (q.includes('حج') || q.includes('عمرة')) {
            return `لدينا باقات متميزة للحج والعمرة تشمل التأشيرة والفندق والمواصلات. للحجز كلمنا واتساب ${COMPANY_INFO.whatsapp}`;
        }
        if (q.includes('سعر') || q.includes('كم')) {
            return `الأسعار تختلف حسب الوجهة والوقت. بفضل تزويدنا بالتفاصيل أو التواصل معنا على ${COMPANY_INFO.phone} للحصول على أفضل عرض.`;
        }
        if (q.includes('حجز')) {
            return `يسعدنا خدمتك! يمكنك الحجز مباشرة عبر الموقع أو بزيارة عنواننا في ${COMPANY_INFO.address}.`;
        }
        if (q.includes('رقم') || q.includes('تواصل')) {
            return `يمكنك التواصل معنا عبر الهاتف ${COMPANY_INFO.phone} أو واتساب ${COMPANY_INFO.whatsapp}.`;
        }

        return `شكراً لتواصلك مع ${COMPANY_INFO.name}. أنا هنا لمساعدتك في كل ما يخص السفر والسياحة والحج والعمرة. هل لديك استفسار محدد؟`;
    }
}

export const aiService = new AIService();
