import { useState, useEffect, useRef } from 'react';
import { api } from './api.js';


// ==============================================
// 🎙️ نظام التعرف والنطق الصوتي
// ==============================================

// تحويل الأرقام إلى كلمات عربية
const numberToArabic = (num) => {
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    if (num === 0) return 'صفر';
    if (num < 10) return ones[num];
    if (num < 100) {
        const t = Math.floor(num / 10);
        const o = num % 10;
        return (o > 0 ? ones[o] + ' و' : '') + tens[t];
    }
    if (num < 1000) {
        const h = Math.floor(num / 100);
        const rest = num % 100;
        return hundreds[h] + (rest > 0 ? ' و' + numberToArabic(rest) : '');
    }
    return num.toString();
};

// النطق الصوتي باستخدام Google Cloud TTS
// النطق الصوتي باستخدام Google Cloud TTS removed from here to move inside component


// ==============================================
// 🤖 قاعدة المعرفة و الردود الذكية
// ==============================================

const KNOWLEDGE_BASE = {
    company: {
        name: "الكويت للسفريات والسياحة",
        phone: "776358963",
        whatsapp: "967776358963",
        email: "alkuwaitagency2019@gmail.com",
        address: "صنعاء - الستين الشمالي"
    },

    responses: {
        greeting: `مرحباً بك في الكويت للسفريات! نقدم خدمات الحج والعمرة، حجوزات الطيران، والتأشيرات. كيف يمكنني مساعدتك؟`,

        services: `نقدم خدمات متنوعة: حج وعمرة، حجوزات طيران، تأشيرات للسعودية والإمارات ومصر وتركيا، وجوازات السفر.`,

        hajj: `لدينا باقات حج وعمرة شاملة تبدأ من 800 دولار، تشمل التأشيرة والفندق والنقل. للحجز اتصل على 776358963`,

        flights: `نوفر تذاكر طيران لجميع الوجهات: إسطنبول 450 دولار، القاهرة 300 دولار، دبي 400 دولار، ماليزيا 650 دولار.`,

        visas: `نخلص تأشيرات السعودية والإمارات ومصر والأردن وتركيا بسرعة ومضمونة.`,

        contact: `يمكنك الاتصال على 776358963 أو واتساب 967776358963. عنواننا في صنعاء - الستين الشمالي.`,

        thanks: `العفو! يسعدنا خدمتك دائماً في الكويت للسفريات.`,

        default: `شكراً لتواصلك معنا. للمساعدة اتصل على 776358963 أو واتساب 967776358963`
    }
};

// توليد الرد الذكي
const getResponse = (userMessage) => {
    const msg = userMessage.toLowerCase();
    const responses = KNOWLEDGE_BASE.responses;

    if (/مرحب|سلام|اهلا|صباح|مساء/.test(msg)) return responses.greeting;
    if (/خدمات|تقدم|ماذا|ايش/.test(msg)) return responses.services;
    if (/حج|عمرة|مكة|المدينة/.test(msg)) return responses.hajj;
    if (/طيران|رحل|سفر|تذكرة/.test(msg)) return responses.flights;
    if (/تأشير|فيزا|visa/.test(msg)) return responses.visas;
    if (/اتصال|تواصل|رقم|هاتف|واتس/.test(msg)) return responses.contact;
    if (/شكر/.test(msg)) return responses.thanks;

    return responses.default;
};

// ==============================================
// 🎨 المكون الرئيسي
// ==============================================

function VoiceAssistant({ openModal }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [provider, setProvider] = useState('ollama'); // 'ollama' or 'gemini'
    const [availableVoices, setAvailableVoices] = useState([]); // Store loaded voices
    const [isMuted, setIsMuted] = useState(false); // كتم الصوت

    const recognitionRef = useRef(null);
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null); // للتحكم في إيقاف الطلب
    const audioRef = useRef(null); // لتتبع ملف الصوت المشغل (MP3)


    // النطق الصوتي
    const speak = async (text, onStart = null, onEnd = null) => {
        if (!text || isMuted) {
            onEnd && onEnd();
            return;
        }

        try {
            console.log("🔊 Generating TTS for:", text);

            const processedText = text.replace(/[*_#`]/g, '').replace(/\s+/g, ' ').trim();

            const response = await api('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: processedText })
            });

            if (!response.ok) throw new Error('TTS Network Error');

            const data = await response.json();

            if (data.audio) {
                const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                audioRef.current = audio; // Track audio logic

                audio.onplay = () => onStart && onStart();
                audio.onended = () => {
                    onEnd && onEnd();
                    audioRef.current = null;
                };
                audio.onerror = () => {
                    console.error("Audio Playback Error");
                    onEnd && onEnd();
                };

                await audio.play();
            } else {
                throw new Error('No audio content');
            }

        } catch (error) {
            if (isMuted) return; // Double check
            console.error('TTS Failed, falling back to browser:', error);

            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);

            const voices = window.speechSynthesis.getVoices();
            const arabicVoice = voices.find(v => v.lang.includes('ar'));

            if (arabicVoice) utterance.voice = arabicVoice;

            utterance.lang = 'ar-SA';
            utterance.rate = 1.0;
            utterance.onstart = () => onStart && onStart();
            utterance.onend = () => onEnd && onEnd();
            utterance.onerror = () => onEnd && onEnd();
            window.speechSynthesis.speak(utterance);
        }
    };

    // دالة إيقاف الاستجابة (الصوت والنص)
    const stopResponse = () => {
        // 1. إيقاف التحدث (TTS & Audio)
        window.speechSynthesis.cancel();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsSpeaking(false);

        // 2. إيقاف جلب النص (Fetch Abort)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // 3. إيقاف حالة الاستماع إذا كانت نشطة
        if (isListening) {
            if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (e) { }
            setIsListening(false);
        }

        console.log("🛑 تم إيقاف الاستجابة والمقاطعة بنجاح");
    };

    // تهيئة نظام التعرف على الصوت
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) return;

        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'ar-SA';
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            handleUserMessage(transcript);
            setIsListening(false);
        };

        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);

        // تحميل الأصوات
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                setAvailableVoices(voices);
            }
        };

        loadVoices();
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.onvoiceschanged = null;
            }
        };
    }, []);

    // التمرير التلقائي للرسائل
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // بدء الاستماع
    const startListening = () => {
        if (!recognitionRef.current || isListening) return;

        // إيقاف أي صوت حالي عند بدء الاستماع
        stopResponse();

        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error('فشل بدء الاستماع:', e);
        }
    };

    // معالجة رسالة المستخدم
    const handleUserMessage = async (text) => {
        if (!text.trim()) return;

        // 1. إضافة رسالة المستخدم للواجهة
        setMessages(prev => [...prev, { role: 'user', content: text }]);

        // 2. إظهار مؤشر الكتابة (اختياري، هنا نستخدم رسالة مؤقتة)
        // setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);

        try {
            // 3. إرسال الطلب للسيرفر بمعالجة التدفق (Stream)
            // إضافة رسالة فارغة للمساعد للبدء
            setMessages(prev => [...prev, { role: 'assistant', content: '', isTyping: true }]);

            // تهيئة AbortController جديد
            abortControllerRef.current = new AbortController();

            const response = await api('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    provider: provider,
                    context: messages.slice(-6).map(m => ({
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.content
                    }))
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiReply = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                aiReply += chunk;

                // تحديث الرسالة الأخيرة بالنص الجديد
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg.role === 'assistant') {
                        lastMsg.content = aiReply;
                        lastMsg.isTyping = true; // Still typing
                    }
                    return newMessages;
                });
            }

            // بعد اكتمال الرد
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === 'assistant') {
                    lastMsg.isTyping = false; // Done typing
                }
                return newMessages;
            });

            // 5. نطق الرد الكامل (يمكن تحسينه لنطق الجمل المكتملة لاحقاً)
            if (!isMuted) {
                speak(aiReply,
                    () => setIsSpeaking(true),
                    () => {
                        setIsSpeaking(false);
                        if (isOpen) { /* Do nothing, wait for user click */ }
                    }
                );
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('تمت مقاطعة الطلب بناءً على رغبة المستخدم.');
                setMessages(prev => {
                    // إزالة مؤشر الكتابة من آخر رسالة إذا تم الإلغاء
                    const newMessages = [...prev];
                    const lastMsg = newMessages[newMessages.length - 1];
                    if (lastMsg && lastMsg.isTyping) {
                        lastMsg.isTyping = false;
                        lastMsg.content += ' (تمت المقاطعة)';
                    }
                    return newMessages;
                });
                return;
            }
            console.error('فشل الاتصال بالمساعد الذكي:', error);
            // Fallback: رد محلي في حال فشل الاتصال
            const fallbackResponse = "عذراً، لا يمكنني الاتصال بالخادم حالياً. يرجى المحاولة لاحقاً.";
            setMessages(prev => [...prev, { role: 'assistant', content: fallbackResponse }]);
            if (!isMuted) {
                speak(fallbackResponse);
            }
        }
    };

    // إرسال رسالة نصية
    const handleTextSubmit = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        handleUserMessage(inputText);
        setInputText('');
    };

    // فتح/إغلاق المساعد
    const toggleAssistant = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);

        if (nextState && messages.length === 0) {
            setTimeout(() => {
                const welcome = KNOWLEDGE_BASE.responses.greeting;
                setMessages([{ role: 'assistant', content: welcome }]);
                if (!isMuted) {
                    speak(welcome,
                        () => setIsSpeaking(true),
                        () => {
                            setIsSpeaking(false);
                            // startListening(); // Removed auto start
                        }
                    );
                }
            }, 500);
        }
    };

    // إعادة تعيين المحادثة
    const resetChat = () => {
        setMessages([{ role: 'assistant', content: KNOWLEDGE_BASE.responses.greeting }]);
        setIsListening(false);
        setIsSpeaking(false);
        window.speechSynthesis.cancel();
    };

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        return null;
    }

    return (
        <>
            {/* زر فتح المساعد */}
            <button
                onClick={toggleAssistant}
                style={{
                    position: 'fixed',
                    bottom: '30px',
                    left: '30px',
                    width: '70px',
                    height: '70px',
                    borderRadius: '50%',
                    background: isOpen ? '#8E2025' : 'linear-gradient(135deg, #8E2025 0%, #152C45 100%)',
                    border: 'none',
                    boxShadow: '0 10px 30px rgba(142, 32, 37, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    transition: 'all 0.3s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
            >
                <i
                    className={isOpen ? 'fas fa-times' : 'fas fa-robot'}
                    style={{ color: 'white', fontSize: '32px' }}
                ></i>
            </button>

            {/* نافذة المحادثة */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: '120px',
                    left: '30px',
                    width: '400px',
                    maxWidth: 'calc(100vw - 60px)',
                    height: '600px',
                    maxHeight: 'calc(100vh - 200px)',
                    background: 'white',
                    borderRadius: '20px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 9998,
                    animation: 'slideUp 0.3s ease-out'
                }}>

                    {/* الهيدر */}
                    <div style={{
                        background: 'linear-gradient(135deg, #8E2025 0%, #152C45 100%)',
                        padding: '20px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px'
                    }}>
                        <div style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <i className="fas fa-robot" style={{ fontSize: '24px' }}></i>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '18px' }}>المساعد الذكي</div>
                            <div style={{ fontSize: '14px', opacity: 0.9 }}>
                                {isSpeaking ? '🔊 يتحدث...' : isListening ? '🎤 يستمع...' : '🟢 متاح'}
                            </div>
                        </div>

                        {/* New Chat Button */}
                        <div
                            onClick={resetChat}
                            title="محادثة جديدة"
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                width: '35px',
                                height: '35px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: '0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
                            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                        >
                            <i className="fas fa-redo-alt" style={{ fontSize: '14px', pointerEvents: 'none' }}></i>
                        </div>

                        {/* Mute Button */}
                        <div
                            onClick={() => {
                                const newMuteState = !isMuted;
                                setIsMuted(newMuteState);
                                if (newMuteState) {
                                    // Stop all audio immediately
                                    window.speechSynthesis.cancel();
                                    if (audioRef.current) {
                                        audioRef.current.pause();
                                        audioRef.current.currentTime = 0;
                                    }
                                    setIsSpeaking(false);
                                }
                            }}
                            title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
                            style={{
                                background: isMuted ? 'rgba(231, 76, 60, 0.4)' : 'rgba(255,255,255,0.2)',
                                width: '35px',
                                height: '35px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: '0.2s',
                                border: isMuted ? '1px solid #ff6b6b' : 'none'
                            }}
                        >
                            <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`} style={{ fontSize: '14px', pointerEvents: 'none' }}></i>
                        </div>

                        {/* Provider Toggle */}
                        <div
                            onClick={() => setProvider(prev => prev === 'ollama' ? 'gemini' : 'ollama')}
                            title={`المزود الحالي: ${provider === 'ollama' ? 'Ollama (Local)' : 'Gemini (Cloud)'}`}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                padding: '5px 10px',
                                borderRadius: '15px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                minWidth: '80px',
                                justifyContent: 'center'
                            }}
                        >
                            <i className={`fas ${provider === 'ollama' ? 'fa-hdd' : 'fa-cloud'}`}></i>
                            <span>{provider === 'ollama' ? 'Ollama' : 'Gemini'}</span>
                        </div>
                    </div>

                    {/* منطقة الرسائل */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '20px',
                        background: '#f8f9fa',
                        direction: 'rtl'
                    }}>
                        {messages.map((msg, idx) => (
                            <div key={idx} style={{
                                marginBottom: '15px',
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end'
                            }}>
                                <div style={{
                                    maxWidth: '80%',
                                    padding: '12px 18px',
                                    borderRadius: '18px',
                                    background: msg.role === 'user' ? 'white' : 'linear-gradient(135deg, #8E2025 0%, #152C45 100%)',
                                    color: msg.role === 'user' ? '#333' : 'white',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                    fontSize: '15px',
                                    lineHeight: '1.5'
                                }}>
                                    {msg.content}
                                    {msg.isTyping && <span className="typing-dots"><span>.</span><span>.</span><span>.</span></span>}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* منطقة الإدخال */}
                    <div style={{
                        padding: '15px',
                        background: 'white',
                        borderTop: '1px solid #e0e0e0',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center'
                    }}>
                        {/* زر المقاطعة (يظهر فقط عند التحدث أو الكتابة) */}
                        {(isSpeaking || (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].isTyping)) && (
                            <button
                                onClick={stopResponse}
                                title="مقاطعة"
                                style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: '#e74c3c', // أحمر للمقاطعة
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 4px 12px rgba(231, 76, 60, 0.4)',
                                    animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}
                            >
                                <i className="fas fa-hand-paper"></i>
                            </button>
                        )}

                        <button
                            onClick={startListening}
                            disabled={isListening || isSpeaking}
                            style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                border: 'none',
                                background: isListening ? '#D4AF37' : '#152C45',
                                color: 'white',
                                cursor: isListening ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(21, 44, 69, 0.3)',
                                display: (isSpeaking || (messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].isTyping)) ? 'none' : 'flex'
                            }}
                        >
                            <i className={isListening ? 'fas fa-stop' : 'fas fa-microphone'}></i>
                        </button>

                        <form onSubmit={handleTextSubmit} style={{ flex: 1, display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="اكتب رسالتك..."
                                disabled={isListening}
                                style={{
                                    flex: 1,
                                    padding: '12px 15px',
                                    borderRadius: '25px',
                                    border: '2px solid #e0e0e0',
                                    outline: 'none',
                                    fontSize: '15px',
                                    fontFamily: 'inherit',
                                    transition: 'border-color 0.3s ease'
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#8E2025'}
                                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim() || isSpeaking}
                                style={{
                                    padding: '0 20px',
                                    height: '50px',
                                    borderRadius: '25px',
                                    border: 'none',
                                    background: inputText.trim() ? 'linear-gradient(135deg, #8E2025 0%, #152C45 100%)' : '#ccc',
                                    color: 'white',
                                    cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                                    fontSize: '16px'
                                }}
                            >
                                إرسال
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes popIn {
                    0% { opacity: 0; transform: scale(0.5); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .typing-dots span {
                    animation: blink 1.4s infinite both;
                    font-size: 20px;
                    margin-left: 2px;
                }
                .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes blink {
                    0% { opacity: 0.2; }
                    20% { opacity: 1; }
                    100% { opacity: 0.2; }
                }
            `}</style>
        </>
    );
}

export default VoiceAssistant;
