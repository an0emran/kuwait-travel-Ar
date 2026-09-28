import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api.js';

// Service durations and policies
const SERVICE_POLICIES = {
    'حج': { duration: 30, description: 'باقة الحج الكاملة', cancellation: '30 يوم قبل الموعد' },
    'عمرة': { duration: 14, description: 'رحلة عمرة شاملة', cancellation: '14 يوم قبل الموعد' },
    'طيران': { duration: 1, description: 'حجز تذكرة طيران', cancellation: '24 ساعة قبل الإقلاع' },
    'تأشيرة': { duration: 7, description: 'معالجة التأشيرة', cancellation: 'قبل بدء المعالجة' },
    'جواز': { duration: 14, description: 'استخراج/تجديد جواز', cancellation: 'قبل بدء الإجراءات' },
    'default': { duration: 7, description: 'خدمة عامة', cancellation: '7 أيام قبل الموعد' }
};

const DESTINATIONS = [
    { name: 'مكة المكرمة', country: 'السعودية', icon: 'fa-kaaba' },
    { name: 'المدينة المنورة', country: 'السعودية', icon: 'fa-mosque' },
    { name: 'إسطنبول', country: 'تركيا', icon: 'fa-landmark' },
    { name: 'القاهرة', country: 'مصر', icon: 'fa-monument' },
    { name: 'دبي', country: 'الإمارات', icon: 'fa-city' },
    { name: 'عمان', country: 'الأردن', icon: 'fa-archway' },
];

function UserDashboard({ user }) {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('bookings');

    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }

        fetch(`/api/my-bookings?phone=${user.phone}`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                setBookings(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch bookings", err);
                setLoading(false);
            });
    }, [user, navigate]);

    // Calculate remaining days
    const calculateDaysRemaining = (bookingDate, serviceName) => {
        const policy = Object.entries(SERVICE_POLICIES).find(([key]) =>
            serviceName?.toLowerCase().includes(key.toLowerCase())
        )?.[1] || SERVICE_POLICIES.default;

        const start = new Date(bookingDate);
        const end = new Date(start);
        end.setDate(end.getDate() + policy.duration);

        const today = new Date();
        const remaining = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
        return { remaining, total: policy.duration, policy };
    };

    if (!user) return null;

    return (
        <div className="dashboard-page" style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', direction: 'rtl' }}>
            <button onClick={() => navigate(-1)} className="btn-main" style={{ marginBottom: '20px' }}>
                <i className="fas fa-arrow-right"></i> رجوع
            </button>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #1f3c58, #9e2a2f)', color: '#fff', padding: '30px', borderRadius: '15px', marginBottom: '30px', boxShadow: '0 5px 20px rgba(0,0,0,0.2)' }}>
                <h1 style={{ margin: 0 }}>مرحباً، {user.name}</h1>
                <p style={{ opacity: 0.9, marginTop: '10px' }}>
                    <i className={user.account_type === 'company' ? 'fas fa-building' : 'fas fa-user'}></i>
                    {' '}{user.account_type === 'company' ? 'حساب شركات' : 'حساب أفراد'}
                </p>
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.85rem' }}>
                        <i className="fas fa-shield-alt"></i> بياناتك محمية ومشفرة
                    </span>
                    <span style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.85rem' }}>
                        <i className="fas fa-lock"></i> اتصال آمن SSL
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {[
                    { id: 'bookings', label: 'حجوزاتي', icon: 'fa-ticket-alt' },
                    { id: 'destinations', label: 'الوجهات المتاحة', icon: 'fa-map-marked-alt' },
                    { id: 'policies', label: 'سياسات الحجز', icon: 'fa-file-contract' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '12px 20px',
                            border: 'none',
                            borderRadius: '10px',
                            background: activeTab === tab.id ? 'var(--primary)' : '#f0f0f0',
                            color: activeTab === tab.id ? 'white' : '#333',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        <i className={`fas ${tab.icon}`}></i> {tab.label}
                    </button>
                ))}
            </div>

            {/* Bookings Tab */}
            {activeTab === 'bookings' && (
                <div>
                    <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>
                        <i className="fas fa-ticket-alt"></i> حجوزاتي
                    </h2>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}><i className="fas fa-spinner fa-spin fa-2x"></i></div>
                    ) : bookings.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: '10px' }}>
                            <i className="fas fa-inbox fa-3x" style={{ color: '#ccc', marginBottom: '15px' }}></i>
                            <p>لا توجد حجوزات حالياً</p>
                            <button onClick={() => navigate('/')} className="btn-main" style={{ marginTop: '15px' }}>احجز الآن</button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '20px' }}>
                            {bookings.map(booking => {
                                const { remaining, total, policy } = calculateDaysRemaining(booking.created_at, booking.service_name);
                                const progress = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));

                                return (
                                    <div key={booking.id} style={{
                                        background: '#fff',
                                        padding: '25px',
                                        borderRadius: '15px',
                                        boxShadow: '0 3px 15px rgba(0,0,0,0.08)',
                                        border: '1px solid #eee'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                                            <div>
                                                <h3 style={{ margin: '0 0 10px 0', color: 'var(--secondary)' }}>
                                                    <i className="fas fa-suitcase"></i> {booking.service_name}
                                                </h3>
                                                <p style={{ color: '#777', fontSize: '0.9rem', margin: '5px 0' }}>
                                                    <i className="fas fa-calendar"></i> تاريخ الحجز: {new Date(booking.created_at).toLocaleDateString('ar-EG')}
                                                </p>
                                                {booking.destination && (
                                                    <p style={{ color: '#555', margin: '5px 0' }}>
                                                        <i className="fas fa-map-marker-alt" style={{ color: 'var(--primary)' }}></i> الوجهة: <strong>{booking.destination}</strong>
                                                    </p>
                                                )}
                                                {booking.days && (
                                                    <p style={{ color: '#555', margin: '5px 0' }}>
                                                        <i className="fas fa-clock"></i> المدة: {booking.days} يوم
                                                    </p>
                                                )}
                                            </div>

                                            <div style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '10px 20px',
                                                    borderRadius: '25px',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 'bold',
                                                    background: booking.status === 'confirmed' ? '#d4edda' : booking.status === 'cancelled' ? '#f8d7da' : '#fff3cd',
                                                    color: booking.status === 'confirmed' ? '#155724' : booking.status === 'cancelled' ? '#721c24' : '#856404'
                                                }}>
                                                    {booking.status === 'confirmed' ? '✅ مؤكد' : booking.status === 'cancelled' ? '❌ ملغي' : '⏳ قيد المراجعة'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Countdown Progress */}
                                        <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                                    <i className="fas fa-hourglass-half"></i> الأيام المتبقية
                                                </span>
                                                <span style={{
                                                    fontWeight: 'bold',
                                                    color: remaining > 0 ? '#27ae60' : '#e74c3c',
                                                    fontSize: '1.2rem'
                                                }}>
                                                    {remaining > 0 ? `${remaining} يوم` : 'منتهي'}
                                                </span>
                                            </div>
                                            <div style={{
                                                height: '10px',
                                                background: '#e0e0e0',
                                                borderRadius: '5px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${progress}%`,
                                                    height: '100%',
                                                    background: remaining > 3 ? 'linear-gradient(90deg, #27ae60, #2ecc71)' : 'linear-gradient(90deg, #e74c3c, #c0392b)',
                                                    borderRadius: '5px',
                                                    transition: 'width 0.3s'
                                                }}></div>
                                            </div>
                                            <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
                                                سياسة الإلغاء: {policy.cancellation}
                                            </small>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Destinations Tab */}
            {activeTab === 'destinations' && (
                <div>
                    <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>
                        <i className="fas fa-map-marked-alt"></i> الوجهات المتاحة للحجز
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        {DESTINATIONS.map((dest, idx) => (
                            <div key={idx} style={{
                                background: 'linear-gradient(135deg, #fff, #f8f9fa)',
                                padding: '25px',
                                borderRadius: '15px',
                                textAlign: 'center',
                                boxShadow: '0 3px 15px rgba(0,0,0,0.08)',
                                cursor: 'pointer',
                                transition: 'transform 0.3s',
                                border: '1px solid #eee'
                            }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <i className={`fas ${dest.icon}`} style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '15px' }}></i>
                                <h3 style={{ margin: '0 0 5px 0', color: 'var(--secondary)' }}>{dest.name}</h3>
                                <p style={{ color: '#777', margin: 0 }}>{dest.country}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Policies Tab */}
            {activeTab === 'policies' && (
                <div>
                    <h2 style={{ color: 'var(--primary)', marginBottom: '20px' }}>
                        <i className="fas fa-file-contract"></i> سياسات الحجز والخدمات
                    </h2>

                    <div style={{ background: '#fff', padding: '25px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 3px 15px rgba(0,0,0,0.08)' }}>
                        <h3 style={{ color: 'var(--secondary)', marginTop: 0 }}><i className="fas fa-clock"></i> مدة الخدمات</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8f9fa' }}>
                                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #eee' }}>الخدمة</th>
                                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #eee' }}>المدة</th>
                                    <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #eee' }}>سياسة الإلغاء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(SERVICE_POLICIES).filter(([k]) => k !== 'default').map(([name, policy]) => (
                                    <tr key={name}>
                                        <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{policy.description}</td>
                                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{policy.duration} يوم</td>
                                        <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{policy.cancellation}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ background: '#fff', padding: '25px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 3px 15px rgba(0,0,0,0.08)' }}>
                        <h3 style={{ color: 'var(--secondary)', marginTop: 0 }}><i className="fas fa-shield-alt"></i> حماية البيانات والتشفير</h3>
                        <ul style={{ lineHeight: '2', color: '#555' }}>
                            <li><i className="fas fa-check" style={{ color: '#27ae60' }}></i> جميع البيانات مشفرة باستخدام تقنية SSL/TLS</li>
                            <li><i className="fas fa-check" style={{ color: '#27ae60' }}></i> لا نشارك بياناتك الشخصية مع أي طرف ثالث</li>
                            <li><i className="fas fa-check" style={{ color: '#27ae60' }}></i> تُحفظ معلومات الدفع بشكل آمن ومشفر</li>
                            <li><i className="fas fa-check" style={{ color: '#27ae60' }}></i> يمكنك طلب حذف بياناتك في أي وقت</li>
                        </ul>
                    </div>

                    <div style={{ background: '#fff', padding: '25px', borderRadius: '15px', boxShadow: '0 3px 15px rgba(0,0,0,0.08)' }}>
                        <h3 style={{ color: 'var(--secondary)', marginTop: 0 }}><i className="fas fa-info-circle"></i> شروط عامة</h3>
                        <ul style={{ lineHeight: '2', color: '#555' }}>
                            <li>يتم تأكيد الحجز خلال 24-48 ساعة عمل</li>
                            <li>يجب توفير صورة جواز السفر ساري المفعول للسفر الدولي</li>
                            <li>الأسعار قابلة للتغيير حسب توفر الخدمة</li>
                            <li>في حالة الإلغاء، يرجى التواصل معنا مباشرة</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserDashboard;
