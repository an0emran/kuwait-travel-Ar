import { useState, useEffect } from 'react';
import './App.css';
import * as XLSX from 'xlsx';
import { api } from './api.js';

function PilgrimsManager({ user }) {
    const [activeTab, setActiveTab] = useState('pilgrims'); // pilgrims, groups, alerts
    const [pilgrims, setPilgrims] = useState([]);
    const [groups, setGroups] = useState([]);
    const [agents, setAgents] = useState([]);

    // Filters
    const [selectedAgent, setSelectedAgent] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [showGroupForm, setShowGroupForm] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [bulkData, setBulkData] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        passport_number: '',
        arrival_date: '',
        sponsor_name: '',
        sponsor_phone: '',
        group_id: ''
    });

    const [groupFormData, setGroupFormData] = useState({
        name: ''
    });

    useEffect(() => {
        if (user) {
            loadData();
        }
        const interval = setInterval(() => {
            if (user) loadData();
        }, 30000); // Auto refresh
        return () => clearInterval(interval);
    }, [user, selectedAgent, selectedGroup]);

    const loadData = async () => {
        if (!user) return;
        await Promise.all([loadPilgrims(), loadGroups(), loadAgents()]);
    };

    const loadPilgrims = async () => {
        try {
            if (!user) return;

            let queryParams = new URLSearchParams();

            // STRICT FILTERING: If not admin, MUST send agent_id
            if (user.role !== 'admin') {
                queryParams.append('agent_id', user.id);
            } else if (selectedAgent) {
                // If admin and selected an agent
                queryParams.append('agent_id', selectedAgent);
            }
            // If admin and no agent selected -> fetch all (no agent_id param)

            if (selectedGroup) queryParams.append('group_id', selectedGroup);

            const res = await api(`/api/pilgrims?${queryParams.toString()}`);
            const data = await res.json();
            setPilgrims(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error loading pilgrims:', err);
        }
    };

    const loadGroups = async () => {
        try {
            if (!user) return;

            let queryParams = '';
            if (user.role !== 'admin') {
                queryParams = `?agent_id=${user.id}`;
            } else if (selectedAgent) {
                queryParams = `?agent_id=${selectedAgent}`;
            }

            const res = await api(`/api/groups${queryParams}`);
            const data = await res.json();
            setGroups(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error loading groups:', err);
        }
    };

    const loadAgents = async () => {
        if (user?.role === 'admin') {
            try {
                const res = await api('/api/agents');
                const data = await res.json();
                setAgents(data);
            } catch (err) {
                console.error('Error loading agents:', err);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api('/api/pilgrims', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    agent_id: user?.role === 'admin' && selectedAgent ? selectedAgent : user?.id
                })
            });

            if (res.ok) {
                alert('✅ تم إضافة المعتمر بنجاح');
                setFormData({ name: '', passport_number: '', arrival_date: '', sponsor_name: '', sponsor_phone: '', group_id: '' });
                setShowForm(false);
                loadPilgrims();
            }
        } catch (err) {
            alert('❌ حدث خطأ');
        }
    };

    const handleGroupSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: groupFormData.name,
                    agent_id: user?.role === 'admin' && selectedAgent ? selectedAgent : user?.id
                })
            });

            if (res.ok) {
                alert('✅ تم إنشاء المجموعة بنجاح');
                setGroupFormData({ name: '' });
                setShowGroupForm(false);
                loadGroups();
            }
        } catch (err) {
            alert('❌ حدث خطأ');
        }
    };

    // Bulk Upload Functions
    const downloadTemplate = () => {
        const template = [
            ['الاسم الكامل', 'رقم الجواز', 'تاريخ الوصول (YYYY-MM-DD)', 'اسم الضامن (اختياري)', 'رقم الضامن (اختياري)'],
            ['محمد أحمد علي', 'A1234567', '2024-03-15', 'عبدالله محمد', '777123456'],
            ['فاطمة حسن', 'B7654321', '2024-03-16', 'خديجة علي', '777654321']
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(template);
        XLSX.utils.book_append_sheet(wb, ws, 'المعتمرين');
        XLSX.writeFile(wb, 'نموذج_معتمرين.xlsx');
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                // Skip header row and process data
                const processedData = jsonData.slice(1).filter(row => row.length > 0).map(row => ({
                    name: row[0] || '',
                    passport_number: row[1] || '',
                    arrival_date: row[2] || '',
                    sponsor_name: row[3] || '',
                    sponsor_phone: row[4] || ''
                })).filter(p => p.name && p.passport_number && p.arrival_date);

                if (processedData.length === 0) {
                    alert('❌ الملف فارغ أو لا يحتوي على بيانات صحيحة');
                    return;
                }

                setBulkData(processedData);
                setShowBulkUpload(true);
            } catch (error) {
                console.error('Error parsing file:', error);
                alert('❌ خطأ في قراءة الملف. تأكد من أنه ملف Excel صحيح.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleBulkSubmit = async () => {
        if (bulkData.length === 0) {
            alert('❌ لا توجد بيانات للحفظ');
            return;
        }

        setUploadProgress(true);
        try {
            const res = await api('/api/pilgrims/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pilgrims: bulkData,
                    agent_id: user?.role === 'admin' && selectedAgent ? selectedAgent : user?.id
                })
            });

            const result = await res.json();

            if (res.ok) {
                alert(`✅ تم إضافة ${result.count} معتمر بنجاح!`);
                setBulkData([]);
                setShowBulkUpload(false);
                loadPilgrims();
            } else {
                alert('❌ حدث خطأ أثناء الحفظ: ' + (result.error || 'خطأ غير معروف'));
            }
        } catch (err) {
            console.error('Error uploading bulk data:', err);
            alert('❌ فشل الاتصال بالسيرفر');
        } finally {
            setUploadProgress(false);
        }
    };

    // Helper functions
    const getDaysRemaining = (arrivalDate) => {
        const arrival = new Date(arrivalDate);
        const today = new Date();
        const diffTime = Math.abs(today - arrival);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return 90 - diffDays; // 90 days visa
    };

    // 7 Days Alert Logic
    const getAlertStatus = (arrivalDate) => {
        const remaining = getDaysRemaining(arrivalDate);
        const daysPassed = 90 - remaining;

        // Logic: Alert if passed 7 days.
        // Actually user said "alert on 7 days". Usually getting close to expiry is the main alert, 
        // but let's highlight if they have been here for > 7 days as requested or maybe remaining < 7?
        // Voice said: "alerts for 7 days" -> Likely monitoring those who exceeded a week? Or getting close?
        // I'll assume standard Visa logic: alert when stay > 7 days? Or maybe "notify me 7 days BEFORE expiry"?
        // Usually Umrah is 90 days now.
        // "Right of the Mu'tamireen... any add... 7 days... warning... tables..."
        // I will implement: Highlight if days_passed >= 7 TO CHECK status.

        if (daysPassed >= 7) return { status: 'alert', text: 'تجاوز أسبوع', color: '#e67e22' };
        return { status: 'ok', text: 'جديد', color: '#27ae60' };
    };

    const toggleExitStatus = async (pilgrimId, currentStatus) => {
        const newStatus = currentStatus === 'exited' ? 'active' : 'exited';
        try {
            const res = await api(`/api/pilgrims/${pilgrimId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                alert(newStatus === 'exited' ? '✅ تم تسجيل خروج المعتمر' : '✅ تم إلغاء خروج المعتمر');
                loadPilgrims();
            } else {
                alert('❌ حدث خطأ');
            }
        } catch (err) {
            console.error('Error updating exit status:', err);
            alert('❌ فشل الاتصال');
        }
    };

    const renderPilgrimsTable = (data, isAlertView = false) => (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
            <thead>
                <tr style={{ background: '#1f3c58', color: 'white' }}>
                    <th style={{ padding: '12px' }}>الاسم</th>
                    <th style={{ padding: '12px' }}>رقم الجواز</th>
                    <th style={{ padding: '12px' }}>تاريخ الوصول</th>
                    <th style={{ padding: '12px' }}>المجموعة</th>
                    <th style={{ padding: '12px' }}>الحالة</th>
                    <th style={{ padding: '12px' }}>الباقي (90 يوم)</th>
                    <th style={{ padding: '12px' }}>حالة الخروج</th>
                    {user?.role === 'admin' && <th style={{ padding: '12px' }}>الوكيل</th>}
                </tr>
            </thead>
            <tbody>
                {data.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>لا توجد بيانات</td></tr>
                ) : (
                    data.map((p, idx) => {
                        const alertInfo = getAlertStatus(p.arrival_date);
                        const daysRemaining = getDaysRemaining(p.arrival_date);
                        const isExited = p.status === 'exited';
                        return (
                            <tr key={p.id} style={{
                                borderBottom: '1px solid #eee',
                                background: isExited ? '#e8f5e9' : (idx % 2 === 0 ? '#f9f9f9' : 'white'),
                                opacity: isExited ? 0.7 : 1
                            }}>
                                <td style={{ padding: '12px', textDecoration: isExited ? 'line-through' : 'none' }}>{p.name}</td>
                                <td style={{ padding: '12px' }}>{p.passport_number}</td>
                                <td style={{ padding: '12px' }}>{new Date(p.arrival_date).toLocaleDateString('ar-SA')}</td>
                                <td style={{ padding: '12px' }}>{groups.find(g => g.id === p.group_id)?.name || '-'}</td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: '4px', background: alertInfo.color, color: 'white', fontSize: '0.8rem' }}>
                                        {alertInfo.text}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', color: daysRemaining < 10 ? 'red' : 'green', fontWeight: 'bold' }}>
                                    {daysRemaining} يوم
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <button
                                        onClick={() => toggleExitStatus(p.id, p.status)}
                                        style={{
                                            padding: '6px 12px',
                                            background: isExited ? '#27ae60' : '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '5px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {isExited ? '✈️ إلغاء الخروج' : '✅ خرج'}
                                    </button>
                                </td>
                                {user?.role === 'admin' && <td style={{ padding: '12px' }}>{p.agent_name || '-'}</td>}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
    );

    const alertsData = pilgrims.filter(p => getAlertStatus(p.arrival_date).status === 'alert');

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', direction: 'rtl' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #1f3c58, #9e2a2f)', color: 'white', padding: '25px', borderRadius: '15px 15px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🏢 إدارة المعتمرين والوكلاء</h1>
                    <p style={{ margin: '5px 0 0', opacity: 0.9 }}>نظام متابعة الحملات والتفويج</p>
                </div>
                <div style={{ display: 'flex', gap: '30px', textAlign: 'center' }}>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{pilgrims.length}</div>
                        <small>إجمالي المعتمرين</small>
                    </div>
                    <div style={{ borderLeft: '2px solid rgba(255,255,255,0.3)', paddingLeft: '30px' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>
                            {pilgrims.filter(p => p.status === 'exited').length}
                        </div>
                        <small>خرجوا ✈️</small>
                    </div>
                    <div style={{ borderLeft: '2px solid rgba(255,255,255,0.3)', paddingLeft: '30px' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>
                            {pilgrims.filter(p => p.status === 'active').length}
                        </div>
                        <small>باقي 📍</small>
                    </div>
                </div>
            </div>

            {/* Controls & Tabs */}
            <div style={{ background: 'white', padding: '15px', borderRadius: '0 0 15px 15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '20px' }}>

                {/* Global Filters */}
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                    {user?.role === 'admin' && (
                        <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', flex: 1 }}>
                            <option value="">كل الوكلاء</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    )}
                    <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', flex: 1 }}>
                        <option value="">كل المجموعات (الحملات)</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button onClick={loadData} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🔄 تحديث</button>
                    <button onClick={() => window.open('/api/pilgrims/export-pdf', '_blank')} style={{ padding: '10px 20px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>📄 PDF</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '2px solid #eee' }}>
                    <button onClick={() => setActiveTab('pilgrims')} style={{ padding: '15px 30px', background: 'none', border: 'none', borderBottom: activeTab === 'pilgrims' ? '3px solid #1f3c58' : 'none', fontWeight: activeTab === 'pilgrims' ? 'bold' : 'normal', color: activeTab === 'pilgrims' ? '#1f3c58' : '#777', cursor: 'pointer' }}>👥 المعتمرين</button>
                    <button onClick={() => setActiveTab('groups')} style={{ padding: '15px 30px', background: 'none', border: 'none', borderBottom: activeTab === 'groups' ? '3px solid #1f3c58' : 'none', fontWeight: activeTab === 'groups' ? 'bold' : 'normal', color: activeTab === 'groups' ? '#1f3c58' : '#777', cursor: 'pointer' }}>📁 المجموعات (الحملات)</button>
                    <button onClick={() => setActiveTab('alerts')} style={{ padding: '15px 30px', background: 'none', border: 'none', borderBottom: activeTab === 'alerts' ? '3px solid #e74c3c' : 'none', fontWeight: activeTab === 'alerts' ? 'bold' : 'normal', color: activeTab === 'alerts' ? '#e74c3c' : '#777', cursor: 'pointer' }}>
                        ⚠️ التنبيهات ({alertsData.length})
                    </button>
                </div>
            </div>

            {/* Content Areas */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>

                {/* 1. Pilgrims Tab */}
                {activeTab === 'pilgrims' && (
                    <>
                        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                {showForm ? '❌ إخفاء النموذج' : '➕ إضافة معتمر'}
                            </button>

                            <button onClick={downloadTemplate} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                📥 تحميل ملف نموذجي
                            </button>

                            <label style={{ padding: '10px 20px', background: '#9b59b6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'inline-block' }}>
                                📤 رفع ملف Excel/CSV
                                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                            </label>
                        </div>

                        {showForm && (
                            <form onSubmit={handleSubmit} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <input type="text" placeholder="الاسم الرباعي" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
                                <input type="text" placeholder="رقم الجواز" value={formData.passport_number} onChange={e => setFormData({ ...formData, passport_number: e.target.value })} required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
                                <input type="date" placeholder="تاريخ الوصول" value={formData.arrival_date} onChange={e => setFormData({ ...formData, arrival_date: e.target.value })} required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
                                <select value={formData.group_id} onChange={e => setFormData({ ...formData, group_id: e.target.value })} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }}>
                                    <option value="">اختر المجموعة...</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                                <input type="text" placeholder="اسم الضامن" value={formData.sponsor_name} onChange={e => setFormData({ ...formData, sponsor_name: e.target.value })} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
                                <input type="text" placeholder="رقم الضامن" value={formData.sponsor_phone} onChange={e => setFormData({ ...formData, sponsor_phone: e.target.value })} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
                                <button type="submit" style={{ gridColumn: '1 / -1', padding: '12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ البيانات</button>
                            </form>
                        )}
                        {renderPilgrimsTable(pilgrims)}
                    </>
                )}

                {/* 2. Groups Tab */}
                {activeTab === 'groups' && (
                    <>
                        <button onClick={() => setShowGroupForm(!showGroupForm)} style={{ marginBottom: '15px', padding: '10px 20px', background: '#2980b9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            {showGroupForm ? '❌ إخفاء النموذج' : '➕ إنشاء مجموعة جديدة'}
                        </button>

                        {showGroupForm && (
                            <form onSubmit={handleGroupSubmit} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                                <input type="text" placeholder="اسم المجموعة / الحملة" value={groupFormData.name} onChange={e => setGroupFormData({ ...groupFormData, name: e.target.value })} required style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }} />
                                <button type="submit" style={{ padding: '10px 20px', background: '#2980b9', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>حفظ</button>
                            </form>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                            {groups.map(g => (
                                <div key={g.id} style={{ padding: '15px', border: '1px solid #eee', borderRadius: '10px', background: '#f8f9fa' }}>
                                    <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem', color: '#1f3c58' }}>{g.name}</h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.9rem' }}>
                                        <span>📅 {new Date(g.created_at).toLocaleDateString('ar-SA')}</span>
                                        <span>👥 {pilgrims.filter(p => p.group_id === g.id).length} معتمر</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* 3. Alerts Tab */}
                {activeTab === 'alerts' && (
                    <div>
                        <div style={{ padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', marginBottom: '20px', color: '#c0392b' }}>
                            <strong>تنبيه هام:</strong> هذه القائمة تحتوي على المعتمرين الذين تجاوزوا أسبوع (7 أيام) من الوصول.
                        </div>
                        {renderPilgrimsTable(alertsData, true)}
                    </div>
                )}
            </div>

            {/* Bulk Upload Preview Modal */}
            {showBulkUpload && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    direction: 'rtl'
                }}>
                    <div style={{
                        background: 'white',
                        padding: '30px',
                        borderRadius: '15px',
                        maxWidth: '900px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        width: '90%'
                    }}>
                        <h2 style={{ margin: '0 0 20px', color: '#1f3c58' }}>📋 معاينة البيانات المرفوعة</h2>
                        <p style={{ marginBottom: '20px', color: '#666' }}>إجمالي السجلات: <strong>{bulkData.length}</strong> معتمر</p>

                        <div style={{ overflow: 'auto', marginBottom: '20px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#1f3c58', color: 'white' }}>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>#</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>الاسم</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>رقم الجواز</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>تاريخ الوصول</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>الضامن</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bulkData.map((p, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee', background: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                                            <td style={{ padding: '10px' }}>{idx + 1}</td>
                                            <td style={{ padding: '10px' }}>{p.name}</td>
                                            <td style={{ padding: '10px' }}>{p.passport_number}</td>
                                            <td style={{ padding: '10px' }}>{p.arrival_date}</td>
                                            <td style={{ padding: '10px' }}>{p.sponsor_name || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => { setBulkData([]); setShowBulkUpload(false); }}
                                disabled={uploadProgress}
                                style={{ padding: '12px 24px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '8px', cursor: uploadProgress ? 'not-allowed' : 'pointer', opacity: uploadProgress ? 0.6 : 1 }}
                            >
                                ❌ إلغاء
                            </button>
                            <button
                                onClick={handleBulkSubmit}
                                disabled={uploadProgress}
                                style={{ padding: '12px 24px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: uploadProgress ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: uploadProgress ? 0.6 : 1 }}
                            >
                                {uploadProgress ? '⏳ جاري الحفظ...' : '✅ حفظ الكل'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PilgrimsManager;
