import React from 'react';
import { useNavigate } from 'react-router-dom';

function TermsAndConditions() {
    const navigate = useNavigate();

    return (
        <div className="terms-page" style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', direction: 'rtl' }}>
            <button onClick={() => navigate('/')} className="btn-main" style={{ marginBottom: '20px' }}>
                <i className="fas fa-arrow-right"></i> العودة للرئيسية
            </button>

            <div className="terms-content" style={{ background: '#fff', padding: '30px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                <h1 style={{ color: 'var(--primary)', marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>الشروط والأحكام وسياسة الخصوصية</h1>

                <section style={{ marginBottom: '30px' }}>
                    <h2 style={{ color: 'var(--secondary)', fontSize: '1.2rem', marginBottom: '15px' }}>1. سياسة جمع البيانات وتخزينها</h2>
                    <p>نحن في "الكويت للسفريات" نلتزم بحماية خصوصية بياناتك. نقوم بجمع المعلومات الشخصية (الاسم، الهاتف، البريد الإلكتروني، صور الجوازات) فقط لغرض إتمام حجوزات السفر والتأشيرات. يتم تخزين هذه البيانات بشكل آمن ولا يتم مشاركتها مع أي طرف ثالث غير الجهات الرسمية المعنية بإتمام الحجز.</p>
                </section>

                <section style={{ marginBottom: '30px' }}>
                    <h2 style={{ color: 'var(--secondary)', fontSize: '1.2rem', marginBottom: '15px' }}>2. سياسة الاستخدام</h2>
                    <p>استخدامك لهذا الموقع يعني موافقتك على تقديم بيانات صحيحة ودقيقة. يمنع استخدام الموقع لأي أغراض غير قانونية أو احتيالية. تحتفظ الإدارة بحق إيقاف أي حساب يخالف هذه الشروط.</p>
                </section>

                <section style={{ marginBottom: '30px' }}>
                    <h2 style={{ color: 'var(--secondary)', fontSize: '1.2rem', marginBottom: '15px' }}>3. حقوق الطبع والنشر</h2>
                    <p>جميع المحتويات المنشورة على هذا الموقع (نصوص، صور، شعارات) هي ملكية حصرية لـ "الكويت للسفريات" ومحمية بموجب قوانين حقوق الملكية الفكرية. يمنع نسخ أو إعادة نشر أي جزء من المحتوى دون إذن كتابي مسبق.</p>
                </section>

                <section style={{ marginBottom: '30px' }}>
                    <h2 style={{ color: 'var(--secondary)', fontSize: '1.2rem', marginBottom: '15px' }}>4. أمان المعلومات</h2>
                    <p>نستخدم بروتوكولات أمان متقدمة (HTTPS) وتشفير للبيانات لضمان سلامة معلوماتك أثناء النقل والتخزين. نحن نتبع معايير الأمان الدولية لحماية البنية التحتية للموقع.</p>
                </section>

                <div style={{ marginTop: '40px', padding: '15px', background: '#e3f2fd', borderRadius: '5px', fontSize: '0.9rem' }}>
                    <strong>تنويه:</strong> إتمامك لعملية التسجيل يعني موافقتك الكاملة على جميع الشروط المذكورة أعلاه.
                </div>
            </div>
        </div>
    );
}

export default TermsAndConditions;
