import { useState, useEffect } from 'react';

// Simple Arabic Math CAPTCHA Component
function CaptchaGate({ onVerified }) {
    const [num1, setNum1] = useState(0);
    const [num2, setNum2] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [error, setError] = useState('');
    const [isVerified, setIsVerified] = useState(false);

    // Speak the challenge
    const speakChallenge = (n1, n2) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const text = `كم ناتج ${n1} زائد ${n2}؟`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ar-SA';
            utterance.rate = 0.9;

            const voices = window.speechSynthesis.getVoices();
            const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
            if (arabicVoice) utterance.voice = arabicVoice;

            window.speechSynthesis.speak(utterance);
        }
    };

    // Check if already verified in this session
    useEffect(() => {
        const verified = sessionStorage.getItem('captcha_verified');
        if (verified === 'true') {
            setIsVerified(true);
            onVerified && onVerified();
        } else {
            generateNewChallenge();
        }
    }, []);

    const generateNewChallenge = () => {
        const n1 = Math.floor(Math.random() * 10) + 1;
        const n2 = Math.floor(Math.random() * 10) + 1;
        setNum1(n1);
        setNum2(n2);
        setUserAnswer('');
        setError('');

        // Speak the challenge after a short delay
        setTimeout(() => speakChallenge(n1, n2), 500);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const correctAnswer = num1 + num2;

        if (parseInt(userAnswer) === correctAnswer) {
            sessionStorage.setItem('captcha_verified', 'true');
            setIsVerified(true);
            onVerified && onVerified();
        } else {
            setError('إجابة خاطئة، حاول مرة أخرى');
            generateNewChallenge();
        }
    };

    if (isVerified) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, #1f3c58 0%, #9e2a2f 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            direction: 'rtl'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: '40px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                textAlign: 'center',
                maxWidth: '400px',
                width: '90%'
            }}>
                <div style={{ marginBottom: '20px' }}>
                    <i className="fas fa-shield-alt" style={{ fontSize: '50px', color: '#3498db' }}></i>
                </div>

                <h2 style={{ color: '#1f3c58', marginBottom: '10px' }}>
                    التحقق من الهوية
                </h2>

                <p style={{ color: '#666', marginBottom: '25px' }}>
                    للتأكد من أنك إنسان، أجب على السؤال التالي:
                </p>

                <div style={{
                    background: '#f8f9fa',
                    padding: '20px',
                    borderRadius: '15px',
                    marginBottom: '20px'
                }}>
                    <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f3c58' }}>
                        {num1} + {num2} = ؟
                    </span>
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        type="number"
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder="اكتب الجواب هنا"
                        style={{
                            width: '100%',
                            padding: '15px',
                            fontSize: '18px',
                            borderRadius: '10px',
                            border: '2px solid #ddd',
                            textAlign: 'center',
                            marginBottom: '15px',
                            outline: 'none'
                        }}
                        autoFocus
                    />

                    {error && (
                        <p style={{ color: '#e74c3c', marginBottom: '15px' }}>
                            ❌ {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '15px 30px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: 'white',
                            background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: '0.3s'
                        }}
                    >
                        تحقق ✓
                    </button>
                </form>

                <p style={{ color: '#999', fontSize: '0.85rem', marginTop: '20px' }}>
                    <i className="fas fa-lock"></i> هذا التحقق يحمي الموقع من الروبوتات
                </p>
            </div>
        </div>
    );
}

export default CaptchaGate;
