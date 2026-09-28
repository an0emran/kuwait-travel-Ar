import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api.js';

function AdminDashboard({ onLogout }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({ users: 0, messages: 0, bookings: 0 });
    const [users, setUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [notifModalOpen, setNotifModalOpen] = useState(false);
    const [selectedUserPhone, setSelectedUserPhone] = useState(null);
    const [customMessage, setCustomMessage] = useState('');

    // AI State
    const [aiProvider, setAiProvider] = useState('local'); // Default to local
    const [aiStatus, setAiStatus] = useState({});
    const [analyzingIds, setAnalyzingIds] = useState({});

    const navigate = useNavigate();

    useEffect(() => {
        // Fetch AI Status
        api('/api/ai/status').then(res => res.json()).then(data => {
            setAiStatus(data);
            if (!data.local && data.openai) setAiProvider('openai');
        }).catch(err => console.error("AI Status Error:", err));
    }, []);

    useEffect(() => {
        // Fetch stats
        api('/api/admin/stats').then(res => res.json()).then(data => setStats(data));
    }, []);

    const loadUsers = () => {
        api('/api/admin/users').then(res => res.json()).then(data => setUsers(data));
    };

    const loadMessages = () => {
        api('/api/admin/messages').then(res => res.json()).then(data => setMessages(data));
    };

    const loadBookings = () => {
        api('/api/admin/bookings').then(res => res.json()).then(data => setBookings(data));
    };

    useEffect(() => {
        if (activeTab === 'users') loadUsers();
        if (activeTab === 'messages') loadMessages();
        if (activeTab === 'bookings') loadBookings();
    }, [activeTab]);

    const handleDeleteMessage = async (id) => {
        if (confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
            await api(`/api/admin/messages/${id}`, { method: 'DELETE' });
            loadMessages();
        }
    };

    const handleUpdateBooking = async (id, status) => {
        await api(`/api/admin/bookings/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        loadBookings();
    };

    const openNotifModal = (phone) => {
        setSelectedUserPhone(phone);
        setCustomMessage('');
        setNotifModalOpen(true);
    };

    const sendCustomNotification = async () => {
        if (!customMessage) return;
        try {
            await api('/api/admin/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: selectedUserPhone, message: customMessage })
            });
            alert('تم إرسال الإشعار بنجاح');
            setNotifModalOpen(false);
        } catch (e) {
            alert('فشل الإرسال');
        }
    };



    const handleAnalyzeSentiment = async (msgId, text) => {
        setAnalyzingIds(prev => ({ ...prev, [msgId]: true }));
        try {
            const res = await api('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    provider: aiProvider,
                    task: 'sentiment'
                })
            });
            const data = await res.json();

            // If raw response (error or string), handling it might be needed, but assuming JSON for now
            if (data.error) throw new Error(data.error);

            setMessages(prev => prev.map(msg =>
                msg.id === msgId ? { ...msg, sentiment: data } : msg
            ));
        } catch (error) {
            console.error(error);
            alert('Analysis Failed: ' + error.message);
        } finally {
            setAnalyzingIds(prev => ({ ...prev, [msgId]: false }));
        }
    };

    return (
        <div className="admin-dashboard">
            <div className="admin-sidebar">
                <h3>لوحة التحكم</h3>
                <ul>
                    <li className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                        <i className="fas fa-home"></i> نظرة عامة
                    </li>
                    <li className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
                        <i className="fas fa-users"></i> المستخدمين
                    </li>
                    <li className={activeTab === 'bookings' ? 'active' : ''} onClick={() => setActiveTab('bookings')}>
                        <i className="fas fa-ticket-alt"></i> الحجوزات
                    </li>
                    <li className={activeTab === 'messages' ? 'active' : ''} onClick={() => setActiveTab('messages')}>
                        <i className="fas fa-envelope"></i> الرسائل
                    </li>
                    <li className={activeTab === 'ai-tools' ? 'active' : ''} onClick={() => setActiveTab('ai-tools')}>
                        <i className="fas fa-robot"></i> أدوات الذكاء
                    </li>
                    <li onClick={() => { onLogout(); navigate('/'); }}>
                        <i className="fas fa-sign-out-alt"></i> خروج
                    </li>
                </ul>
            </div>

            <div className="admin-content">
                {activeTab === 'overview' && (
                    <div className="stats-grid">
                        <div className="stat-card">
                            <i className="fas fa-users"></i>
                            <h3>المستخدمين</h3>
                            <p>{stats.users}</p>
                        </div>
                        <div className="stat-card">
                            <i className="fas fa-ticket-alt"></i>
                            <h3>الحجوزات</h3>
                            <p>{stats.bookings}</p>
                        </div>
                        <div className="stat-card">
                            <i className="fas fa-envelope"></i>
                            <h3>الرسائل</h3>
                            <p>{stats.messages}</p>
                        </div>
                        <div className="stat-card" onClick={() => navigate('/pilgrims')} style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #1f3c58, #9e2a2f)', color: 'white' }}>
                            <i className="fas fa-users-cog"></i>
                            <h3>متابعة المعتمرين</h3>
                            <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>نظام التتبع</p>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="data-table-container">
                        <h2>المستخدمين المسجلين</h2>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>الاسم</th>
                                    <th>البريد الإلكتروني</th>
                                    <th>الهاتف</th>
                                    <th>نوع الحساب</th>
                                    <th>الدور</th>
                                    <th>تاريخ التسجيل</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.id}</td>
                                        <td>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td>{user.phone}</td>
                                        <td>
                                            {user.account_type === 'company' ?
                                                <span className="badge badge-warning"><i className="fas fa-building"></i> شركات</span> :
                                                <span className="badge"><i className="fas fa-user"></i> أفراد</span>
                                            }
                                        </td>
                                        <td>{user.role}</td>
                                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <button className="btn-small" onClick={() => openNotifModal(user.phone)} style={{ background: 'var(--primary)', color: 'white', padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', marginLeft: '5px' }}>
                                                <i className="fas fa-bell"></i> تنبيه
                                            </button>
                                            <select
                                                value={user.role}
                                                onChange={async (e) => {
                                                    if (confirm(`تغيير صلاحية ${user.name} إلى ${e.target.value}؟`)) {
                                                        await api(`/api/admin/users/${user.id}/role`, {
                                                            method: 'PUT',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ role: e.target.value })
                                                        });
                                                        loadUsers();
                                                    }
                                                }}
                                                style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
                                            >
                                                <option value="user">مستخدم</option>
                                                <option value="admin">أدمن</option>
                                                <option value="agent">وكيل</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className="data-table-container">
                        <h2>رسائل التواصل</h2>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>الهاتف</th>
                                    <th>الرسالة</th>
                                    <th>AI ({aiProvider})</th>
                                    <th>التاريخ</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {messages.map(msg => (
                                    <tr key={msg.id}>
                                        <td>{msg.name}</td>
                                        <td>{msg.phone}</td>
                                        <td>{msg.message}</td>
                                        <td>
                                            {msg.sentiment ? (
                                                <div style={{ fontSize: '0.8rem' }}>
                                                    {msg.sentiment.sentiment === 'Positive' && '✅'}
                                                    {msg.sentiment.sentiment === 'Negative' && '❌'}
                                                    {msg.sentiment.sentiment === 'Neutral' && '😐'}
                                                    <span style={{ marginRight: '5px', color: '#666' }}>{msg.sentiment.summary || msg.sentiment.response || ''}</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleAnalyzeSentiment(msg.id, msg.message)}
                                                    disabled={analyzingIds[msg.id]}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                                                    title={`تحليل باستخدام ${aiProvider}`}
                                                >
                                                    🧠
                                                </button>
                                            )}
                                        </td>
                                        <td>{new Date(msg.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <button className="btn-delete" onClick={() => handleDeleteMessage(msg.id)}>
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'bookings' && (
                    <div className="data-table-container">
                        <h2>طلبات الحجز</h2>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>الخدمة</th>
                                    <th>العميل</th>
                                    <th>الهاتف</th>
                                    <th>الدفع</th>
                                    <th>تفاصيل الباقة</th>
                                    <th>الجواز</th>
                                    <th>ملاحظات</th>
                                    <th>الحالة</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map(booking => (
                                    <tr key={booking.id}>
                                        <td style={{ whiteSpace: 'normal', maxWidth: '120px' }}>{booking.service_name}</td>
                                        <td style={{ whiteSpace: 'normal', maxWidth: '120px' }}>{booking.customer_name}</td>
                                        <td>{booking.phone}</td>
                                        <td>
                                            {booking.payment_method === 'card' && <span className="badge badge-primary"><i className="fas fa-credit-card"></i> بطاقة</span>}
                                            {booking.payment_method === 'bank' && <span className="badge badge-info"><i className="fas fa-university"></i> تحويل</span>}
                                            {booking.payment_method === 'later' && <span className="badge badge-warning"><i className="fas fa-clock"></i> لاحقاً</span>}
                                            {!booking.payment_method && '-'}
                                        </td>
                                        <td style={{ whiteSpace: 'normal', minWidth: '200px' }}>
                                            {(booking.days || booking.package_type || booking.travel_method || booking.age || booking.service_subtype) ? (
                                                <div style={{ fontSize: '0.85rem' }}>
                                                    {booking.destination && <div><i className="fas fa-map-marked-alt"></i> {booking.destination}</div>}
                                                    {booking.days && <div><i className="fas fa-calendar-day"></i> {booking.days} يوم</div>}
                                                    {booking.package_type && <div><i className="fas fa-star"></i> {booking.package_type}</div>}
                                                    {booking.travel_method && <div><i className="fas fa-plane"></i> {booking.travel_method}</div>}
                                                    {booking.service_subtype && <div><i className="fas fa-file-alt"></i> {
                                                        booking.service_subtype === 'new' ? 'أول مرة' :
                                                            booking.service_subtype === 'renewal' ? 'تجديد' :
                                                                booking.service_subtype === 'replacement' ? 'بدل فاقد' : 'بدل تالف'
                                                    }</div>}
                                                    {booking.age && <div><i className="fas fa-user-clock"></i> العمر: {booking.age}</div>}
                                                    {booking.date_of_birth && <div><i className="fas fa-birthday-cake"></i> {booking.date_of_birth}</div>}
                                                    {booking.place_of_birth && <div><i className="fas fa-map-marker-alt"></i> {booking.place_of_birth}</div>}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            {booking.passport_image_path ? (
                                                <a href={`/${booking.passport_image_path}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                                    عرض
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td style={{ maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={booking.notes}>
                                            {booking.notes || '-'}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${booking.status}`}>{booking.status}</span>
                                        </td>
                                        <td>
                                            <select
                                                value={booking.status}
                                                onChange={(e) => handleUpdateBooking(booking.id, e.target.value)}
                                                className="status-select"
                                            >
                                                <option value="pending">قيد الانتظار</option>
                                                <option value="confirmed">مؤكد</option>
                                                <option value="cancelled">ملغي</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {activeTab === 'ai-tools' && (
                <div className="data-table-container">
                    <h2>⚙️ إعدادات الذكاء الاصطناعي</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
                        {['local', 'openai', 'gemini', 'claude'].map(p => (
                            <div key={p}
                                onClick={() => setAiProvider(p)}
                                style={{
                                    padding: '20px',
                                    borderRadius: '10px',
                                    border: aiProvider === p ? '2px solid var(--primary)' : '1px solid #ddd',
                                    background: aiProvider === p ? 'rgba(52, 152, 219, 0.1)' : '#fff',
                                    cursor: 'pointer',
                                    opacity: aiStatus[p] ? 1 : 0.6
                                }}
                            >
                                <h3 style={{ textTransform: 'capitalize', margin: '0 0 10px 0' }}>{p}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{
                                        width: '10px', height: '10px', borderRadius: '50%',
                                        background: aiStatus[p] ? '#2ecc71' : '#e74c3c'
                                    }}></div>
                                    <span>{aiStatus[p] ? 'متصل' : 'غير متوفر'}</span>
                                </div>
                                {!aiStatus[p] && p !== 'local' && <small style={{ color: 'red' }}>Check .env API Key</small>}
                                {!aiStatus[p] && p === 'local' && <small style={{ color: 'red' }}>Ensure Ollama is running</small>}
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '40px', background: '#f8f9fa', padding: '20px', borderRadius: '10px' }}>
                        <h3>💬 تجربة فورية ({aiProvider})</h3>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <input id="ai-playground-input" type="text" placeholder="اكتب رسالة للتجربة..." style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                            <button className="btn-main" onClick={async () => {
                                const val = document.getElementById('ai-playground-input').value;
                                if (!val) return;
                                try {
                                    const res = await api('/api/ai/generate', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ text: val, provider: aiProvider, task: 'chat' })
                                    });
                                    const data = await res.json();
                                    alert(`رد ${aiProvider}:\n\n` + (data.response || JSON.stringify(data)));
                                } catch (e) { alert('Error: ' + e.message); }
                            }}>
                                <i className="fas fa-paper-plane" style={{ marginLeft: '5px' }}></i> إرسال
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {notifModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
                }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '400px', direction: 'rtl' }}>
                        <h3>إرسال تنبيه للمستخدم</h3>
                        <textarea
                            className="form-control"
                            rows="4"
                            placeholder="اكتب رسالتك هنا..."
                            value={customMessage}
                            onChange={e => setCustomMessage(e.target.value)}
                            style={{ marginTop: '10px', marginBottom: '10px' }}
                        ></textarea>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn-main" onClick={sendCustomNotification}>
                                <i className="fas fa-paper-plane" style={{ marginLeft: '5px' }}></i> إرسال
                            </button>
                            <button className="btn-main" style={{ background: '#ccc' }} onClick={() => setNotifModalOpen(false)}>
                                <i className="fas fa-times" style={{ marginLeft: '5px' }}></i> إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
