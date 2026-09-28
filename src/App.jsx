import { useState, useEffect, useRef } from 'react';
import { api, clearCsrfToken } from './api.js';
import { GoogleLogin } from '@react-oauth/google';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import TermsAndConditions from './TermsAndConditions';
import UserDashboard from './UserDashboard';
import VoiceAssistant from './VoiceAssistant';
import CaptchaGate from './CaptchaGate';
import PilgrimsManager from './PilgrimsManager';
import heroBg from './assets/images/hero_bg.jpg';
import hajjSection from './assets/images/hajj_section.jpg';
import offer1 from './assets/images/offer_istanbul.jpg';
import offer2 from './assets/images/offer_cairo.jpg';
import offer3 from './assets/images/offer_malaysia.jpg';
import gallery1 from './assets/images/gallery_makkah.jpg';
import gallery2 from './assets/images/gallery_madinah.jpg';
import gallery3 from './assets/images/gallery_bus.jpg';
import gallery4 from './assets/images/gallery_hotel.jpg';
import flagSA from './assets/images/flag_sa.png';
import flagAE from './assets/images/flag_ae.png';
import flagEG from './assets/images/flag_eg.png';
import flagJO from './assets/images/flag_jo.png';
import flagTR from './assets/images/flag_tr.png';
import aboutImg from './assets/images/about_us.jpg';

const siteData = {
  contact: { phone1: "776358963", whatsapp: "967776358963" },
  images: {
    heroBg: heroBg,
    hajjSection: hajjSection,
    offer1: offer1,
    offer2: offer2,
    offer3: offer3,
    gallery1: gallery1,
    gallery2: gallery2,
    gallery3: gallery3,
    gallery4: gallery4,
    flagSA: flagSA,
    flagAE: flagAE,
    flagEG: flagEG,
    flagJO: flagJO,
    flagTR: flagTR,
    aboutImg: aboutImg,
  },
  prices: { offer1: "$450", offer2: "$300", offer3: "$650" },
  stats: { exp: 10, pilgrims: 5000, destinations: 150, support: 24 }
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('user'); // 'user' or 'admin' 
  const [captchaId, setCaptchaId] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [userCaptchaInput, setUserCaptchaInput] = useState('');
  const [captchaVerified, setCaptchaVerified] = useState(true); // Default true (for global gate)
  // const [isHuman, setIsHuman] = useState(false); // Removed unused
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  /* Notification State */
  const [notification, setNotification] = useState({ message: '', type: '', visible: false });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, visible: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 3000); // Hide after 3 seconds
  };

  // Check for admin access
  useEffect(() => {
    if (location.pathname === '/admin' && userRole !== 'admin') {
      navigate('/');
      showNotification("عذراً، هذه الصفحة مخصصة للمسؤولين فقط.", "error");
    }
  }, [location, userRole, navigate]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1, 2, 'processing', 'success'
  const [selectedService, setSelectedService] = useState('');
  const [bookingData, setBookingData] = useState({
    name: '', phone: '', people: 1, notes: '',
    days: '', packageType: 'economic', travelMethod: 'air', passport: null, paymentMethod: 'card',
    age: '', dob: '', birthPlace: '', serviceSubtype: 'new', destination: ''
  });

  // Refs for animations
  const notificationRef = useRef(null);
  const statsRef = useRef(null);
  const [statsCounted, setStatsCounted] = useState(false);
  const [counts, setCounts] = useState({ exp: 0, pilgrims: 0, destinations: 0, support: 0 });
  const [openDest, setOpenDest] = useState(0);
  const [destinations, setDestinations] = useState([
    { id: 1, title: 'مكة المكرمة', price: 'ريال 500', image: siteData.images.gallery1 },
    { id: 2, title: 'المدينة المنورة', price: 'ريال 300', image: siteData.images.gallery2 },
    { id: 3, title: 'إسطنبول - تركيا', price: '$450', image: siteData.images.offer1 },
    { id: 4, title: 'القاهرة - مصر', price: '$300', image: siteData.images.offer2 },
    { id: 5, title: 'دبي - الإمارات', price: '$400', image: siteData.images.gallery3 },
    { id: 6, title: 'الرياض - السعودية', price: '$350', image: siteData.images.gallery4 },
    { id: 7, title: 'كوالالمبور - ماليزيا', price: '$650', image: siteData.images.offer3 },
  ]);

  // Removed API fetch for destinations to use hardcoded data as requested

  /* CAPTCHA State */
  // Removed duplicates

  // Fetch CAPTCHA from server
  const fetchCaptcha = async () => {
    try {
      const res = await fetch('/api/captcha');
      if (res.ok) {
        const data = await res.json();
        setCaptchaId(data.id);
        setCaptchaQuestion(data.question);
        setUserCaptchaInput('');
      }
    } catch (err) {
      console.error("Failed to fetch captcha", err);
    }
  };

  useEffect(() => {
    if (showLoginModal) {
      fetchCaptcha();
    }
  }, [showLoginModal]);

  // Scroll Reveal Logic
  useEffect(() => {
    const handleScroll = () => {
      const reveals = document.querySelectorAll(".reveal");
      for (let i = 0; i < reveals.length; i++) {
        const windowHeight = window.innerHeight;
        const elementTop = reveals[i].getBoundingClientRect().top;
        if (elementTop < windowHeight - 100) {
          reveals[i].classList.add("active");
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Trigger once on load
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLoggedIn]); // Re-run when login state changes (rendering main site)

  // Stats Counter Logic
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) return;

    const observer = new IntersectionObserver((entries) => {
      // Only trigger if intersecting and not already counted/counting
      if (entries[0].isIntersecting && !statsCounted) {
        startCounter();
      }
    });

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      observer.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoggedIn, statsCounted]);

  const startCounter = () => {
    // Prevent multiple running counters
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatsCounted(true);

    const duration = 2000; // ms
    const steps = 50;
    const intervalTime = duration / steps;

    const targets = siteData.stats;
    let currentStep = 0;

    intervalRef.current = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setCounts({
        exp: Math.floor(targets.exp * progress),
        pilgrims: Math.floor(targets.pilgrims * progress),
        destinations: Math.floor(targets.destinations * progress),
        support: Math.floor(targets.support * progress)
      });

      if (currentStep >= steps) {
        clearInterval(intervalRef.current);
      }
    }, intervalTime);
  };

  // Handle opening modal with service name
  const openModal = (serviceName) => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setSelectedService(serviceName);
    setBookingData({ ...bookingData, serviceSubtype: 'new' });

    // Auto-populate destination if serviceName is a destination
    const dest = destinations.find(d => d.title === serviceName);
    if (dest) {
      setBookingData(prev => ({ ...prev, destination: serviceName }));
    } else {
      setBookingData(prev => ({ ...prev, destination: '' }));
    }

    setModalOpen(true);
    setModalStep(1);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    // Single step submission now

    // Step 2 Submission (Final)
    const formData = new FormData();
    formData.append('service_name', selectedService);
    formData.append('customer_name', bookingData.name);
    formData.append('phone', bookingData.phone);
    formData.append('people_count', bookingData.people);
    formData.append('notes', bookingData.notes);
    formData.append('payment_method', bookingData.paymentMethod);

    if (selectedService.includes('حج') || selectedService.includes('عمرة') || selectedService.includes('تأشير') || selectedService.includes('طيران') || selectedService.includes('سفر')) {
      formData.append('days', bookingData.days);
      formData.append('package_type', bookingData.packageType);
      formData.append('travel_method', bookingData.travelMethod);
      formData.append('destination', bookingData.destination);
      if (bookingData.passport) {
        formData.append('passport', bookingData.passport);
      }
    }

    if (selectedService === 'جوازات السفر' || selectedService === 'البطائق الشخصية') {
      formData.append('age', bookingData.age);
      formData.append('date_of_birth', bookingData.dob);
      formData.append('place_of_birth', bookingData.birthPlace);
      formData.append('service_subtype', bookingData.serviceSubtype);
      if (bookingData.passport) {
        formData.append('passport', bookingData.passport);
      }
    }

    setModalStep('processing');

    try {
      const response = await api('/api/bookings', {
        method: 'POST',
        body: formData // No Content-Type header needed, browser sets it for FormData
      });
      if (response.ok) {
        setModalStep('success');
      } else {
        showNotification("حدث خطأ أثناء الطلب.", "error");
        setModalStep(1); // Go back to form
      }
    } catch (error) {
      console.error("Booking Error:", error);
      showNotification("فشل الاتصال بالسيرفر.", "error");
      setModalStep(1);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    setModalStep('processing');
    setTimeout(() => {
      setModalStep('success');
    }, 3000);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const formData = {
      name: e.target[0].value,
      phone: e.target[1].value,
      message: e.target[2].value
    };

    try {
      const response = await api('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        showNotification("تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.", "success");
        e.target.reset();
      } else {
        showNotification("حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.", "error");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      showNotification("فشل الاتصال بالسيرفر.", "error");
    }
  };

  const [isRegistering, setIsRegistering] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [accountType, setAccountType] = useState('individual');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // duplicates removed

  useEffect(() => {
    if (isLoggedIn && currentUser && currentUser.phone) {
      const fetchNotifications = async () => {
        try {
      const res = await api(`/api/notifications?phone=${currentUser.phone}`);
          if (res.ok) {
            const data = await res.json();
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
          }
        } catch (error) {
          console.error("Failed to fetch notifications");
        }
      };

      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, currentUser]);

  const handleNotificationClick = async () => {
    setShowNotifications(!showNotifications);
    if (unreadCount > 0) {
      try {
        await api('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: currentUser.phone })
        });
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      } catch (e) { console.error(e); }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!agreedToTerms) {
      showNotification("يجب الموافقة على الشروط والأحكام", "error");
      return;
    }
    const formData = {
      name: e.target[0].value,
      email: e.target[1].value,
      password: e.target[2].value,
      phone: e.target[3].value,
      account_type: accountType
    };

    try {
      const response = await api('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setIsLoggedIn(true);
        setCurrentUser(data.user);
        setUserRole(data.user.role || 'user');
        showNotification("تم إنشاء الحساب وتسجيل الدخول بنجاح", "success");
      } else {
        showNotification(data.error || "حدث خطأ أثناء التسجيل.", "error");
      }
    } catch (error) {
      console.error("Error registering:", error);
      showNotification("فشل الاتصال بالسيرفر.", "error");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const formData = {
      email: e.target[0].value,
      password: e.target[1].value,
      captchaId: captchaId,
      captchaAnswer: userCaptchaInput
    };

    if (!formData.captchaAnswer) {
      showNotification("يرجى حل المسألة الرياضية", "error");
      return;
    }

    try {
      const response = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setIsLoggedIn(true);
        setCurrentUser(data.user);
        setUserRole(data.user.role || 'user');
        if (data.user.role === 'admin') {
          navigate('/admin');
        } else {
          // Regular user -> Redirect to dashboard (bookings)
          navigate('/dashboard');
        }

        setShowLoginModal(false); // Ensure modal is closed
        showNotification("تم تسجيل الدخول بنجاح", "success");
        // Reset CAPTCHA
        setUserCaptchaInput('');
        fetchCaptcha();
      } else {
        showNotification(data.error || "بيانات الدخول غير صحيحة", "error");
        // Regenerate CAPTCHA on failed login
        fetchCaptcha();
      }
    } catch (error) {
      console.error("Error logging in:", error);
      showNotification("فشل الاتصال بالسيرفر.", "error");
    }
  };



  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await api('/api/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });

      const data = await response.json();

      if (response.ok) {
        setIsLoggedIn(true);
        setCurrentUser(data.user);
        setUserRole(data.user.role || 'user');
        if (data.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
        setShowLoginModal(false);
        showNotification("تم تسجيل الدخول بواسطة جوجل بنجاح", "success");
      } else {
        showNotification("فشل تسجيل الدخول بواسطة جوجل.", "error");
      }
    } catch (error) {
      console.error("Google Login Error:", error);
      showNotification("فشل الاتصال بالسيرفر.", "error");
    }
  };

  return (
    <>
      {/* CAPTCHA Gate - Shows before content */}
      <VoiceAssistant openModal={openModal} />
      {!captchaVerified && (
        <CaptchaGate onVerified={() => setCaptchaVerified(true)} />
      )}
      <Routes>
        <Route path="/admin" element={<AdminDashboard onLogout={async () => {
          // Call server logout to clear the HttpOnly auth cookie
          try { await api('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); } catch(e) {}
          clearCsrfToken();
          setIsLoggedIn(false);
          setCurrentUser(null);
          setUserRole('user');
          showNotification("تم تسجيل الخروج بنجاح", "success");
        }} />} />
        <Route path="/dashboard" element={<UserDashboard user={currentUser} />} />
        <Route path="/pilgrims" element={<PilgrimsManager user={currentUser} />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/" element={
          !isLoggedIn ? (
            <div id="login-page" style={{ backgroundImage: `linear-gradient(rgba(31, 60, 88, 0.8), rgba(158, 42, 47, 0.8)), url('${siteData.images.heroBg}')` }}>
              <div className="login-card">
                <div className="login-logo">
                  <img src="/logo.jpg" alt="Kuwait Travel" style={{ height: '80px', marginBottom: '20px' }} />
                </div>
                <h2 className="login-title">{isRegistering ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h2>

                {isRegistering ? (
                  <form onSubmit={(e) => {
                    handleRegister(e).then(() => { if (isLoggedIn) setShowLoginModal(false); });
                  }}>
                    <div className="input-group">
                      <label>الاسم الكامل</label>
                      <input type="text" className="input-field" placeholder="الاسم" required />
                      <i className="fas fa-user input-icon"></i>
                    </div>
                    <div className="input-group">
                      <label>البريد الإلكتروني</label>
                      <input type="email" className="input-field" placeholder="email@example.com" required />
                      <i className="fas fa-envelope input-icon"></i>
                    </div>
                    <div className="input-group">
                      <label>كلمة المرور</label>
                      <input type="password" className="input-field" placeholder="••••••••" required />
                      <i className="fas fa-lock input-icon"></i>
                    </div>
                    <div className="input-group">
                      <label>رقم الهاتف</label>
                      <input type="tel" className="input-field" placeholder="965xxxxxxxx" required />
                      <i className="fas fa-phone input-icon"></i>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="radio" name="accountType" value="individual" checked={accountType === 'individual'} onChange={() => setAccountType('individual')} />
                        أفراد
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="radio" name="accountType" value="company" checked={accountType === 'company'} onChange={() => setAccountType('company')} />
                        شركات
                      </label>
                    </div>

                    <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" id="termsCheck" required checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                      <label htmlFor="termsCheck" style={{ margin: 0, fontSize: '0.9rem' }}>
                        أوافق على <span onClick={() => window.open('/terms', '_blank')} style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>الشروط والأحكام</span>
                      </label>
                    </div>

                    <button type="submit" className="btn-login active">
                      <i className="fas fa-user-plus" style={{ marginLeft: '8px' }}></i>
                      إنشاء حساب
                    </button>

                    <div style={{ margin: '20px 0', textAlign: 'center' }}>
                      <p style={{ marginBottom: '10px', color: '#777' }}>أو</p>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <GoogleLogin onSuccess={(res) => { handleGoogleSuccess(res); setShowLoginModal(false); }} onError={() => console.log('Login Failed')} />
                      </div>
                    </div>

                    <p style={{ textAlign: 'center', marginTop: '15px', color: '#666' }}>
                      لديك حساب بالفعل؟ <span onClick={() => setIsRegistering(false)} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}>تسجيل الدخول</span>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={(e) => handleLogin(e)}>
                    <div className="input-group">
                      <label>البريد الإلكتروني</label>
                      <input type="email" className="input-field" placeholder="email@example.com" required />
                      <i className="fas fa-envelope input-icon"></i>
                    </div>
                    <div className="input-group">
                      <label>كلمة المرور</label>
                      <input type="password" className="input-field" placeholder="••••••••" required />
                      <i className="fas fa-lock input-icon"></i>
                    </div>

                    {/* Math Captcha */}
                    <div className="captcha-container" style={{ margin: '15px 0', padding: '15px', background: '#f0f4f8', borderRadius: '10px', textAlign: 'center', border: '1px solid #dce4ec' }}>
                      <label style={{ display: 'block', marginBottom: '10px', color: '#1f3c58', fontWeight: 'bold', fontSize: '1.1rem' }}>
                        <i className="fas fa-shield-alt" style={{ marginLeft: '5px', color: '#27ae60' }}></i>
                        أثبت أنك إنسان:
                        <span style={{ marginRight: '10px', color: '#c0392b', fontSize: '1.2rem', direction: 'ltr', display: 'inline-block' }}>{captchaQuestion}</span>
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="number"
                          value={userCaptchaInput}
                          onChange={(e) => setUserCaptchaInput(e.target.value)}
                          placeholder="اكتب الناتج هنا"
                          required
                          style={{
                            width: '150px',
                            padding: '10px',
                            borderRadius: '5px',
                            border: '2px solid #ddd',
                            textAlign: 'center',
                            fontSize: '1.1rem',
                            fontWeight: 'bold'
                          }}
                        />
                        <button type="button" onClick={fetchCaptcha} style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: '#7f8c8d', fontSize: '1.2rem'
                        }} title="تحديث الصورة">
                          <i className="fas fa-sync-alt"></i>
                        </button>
                      </div>
                    </div>

                    <button type="submit" className="btn-login active" style={{ marginTop: '20px' }}>
                      <i className="fas fa-sign-in-alt" style={{ marginLeft: '8px' }}></i>
                      دخول
                    </button>

                    <div style={{ margin: '20px 0', textAlign: 'center' }}>
                      <p style={{ marginBottom: '10px', color: '#777' }}>أو</p>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <GoogleLogin onSuccess={(res) => { handleGoogleSuccess(res); setShowLoginModal(false); }} onError={() => console.log('Login Failed')} />
                      </div>
                    </div>

                    <p style={{ textAlign: 'center', marginTop: '15px', color: '#666' }}>
                      مستخدم جديد؟ <span onClick={() => setIsRegistering(true)} style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold' }}>إنشاء حساب</span>
                    </p>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="landing-page">
              <header className={isMenuOpen ? 'active' : ''}>
                <div className="logo">
                  <img src="/logo.jpg" alt="Kuwait Travel" style={{ borderRadius: '50%' }} />
                  <h1>الكويت للسفريات</h1>
                </div>
                <nav className={isMenuOpen ? 'active' : ''}>
                  <a href="#hero" onClick={() => setIsMenuOpen(false)}>الرئيسية</a>
                  <a href="#services" onClick={() => setIsMenuOpen(false)}>خدماتنا</a>
                  <a href="#packages" onClick={() => setIsMenuOpen(false)}>العروض</a>
                  <a href="#stats" onClick={() => setIsMenuOpen(false)}>من نحن</a>
                  <a href="#contact" onClick={() => setIsMenuOpen(false)}>اتصل بنا</a>
                  {isLoggedIn && <a href="/pilgrims" onClick={() => setIsMenuOpen(false)}>متابعة المعتمرين</a>}
                  {isLoggedIn && <a href="/dashboard" onClick={() => setIsMenuOpen(false)}>لوحة التحكم</a>}

                  {/* User Icons */}
                  <div className="header-user-icons" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    marginRight: '15px'
                  }}>
                    {/* Notifications Icon */}
                    <div className="notification-icon" onClick={handleNotificationClick} style={{
                      position: 'relative',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '50%',
                      transition: 'all 0.3s ease'
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(142, 32, 37, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <i className="fas fa-bell" style={{
                        fontSize: '1.3rem',
                        color: 'var(--text-main)'
                      }}></i>
                      {unreadCount > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          background: '#e74c3c',
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid white'
                        }}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>

                    {/* User Profile Icon */}
                    <div className="user-profile-icon" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: '25px',
                      transition: 'all 0.3s ease',
                      border: '2px solid #eee'
                    }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(142, 32, 37, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = '#eee';
                      }}>
                      <div style={{
                        width: '35px',
                        height: '35px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1rem'
                      }}>
                        {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start'
                      }}>
                        <span style={{
                          fontWeight: '600',
                          fontSize: '0.9rem',
                          color: 'var(--text-main)',
                          maxWidth: '100px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {currentUser?.name || 'مستخدم'}
                        </span>
                        {currentUser?.role === 'admin' && (
                          <span style={{
                            fontSize: '0.7rem',
                            color: 'var(--primary)',
                            fontWeight: '600'
                          }}>
                            <i className="fas fa-crown" style={{ marginLeft: '3px' }}></i>
                            مدير
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Logout Button */}
                    <button onClick={() => {
                      setIsLoggedIn(false);
                      setCurrentUser(null);
                      setShowLoginModal(false);
                      showNotification("تم تسجيل الخروج", "success");
                    }} className="btn-login-nav logout" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <i className="fas fa-sign-out-alt"></i>
                      <span>خروج</span>
                    </button>
                  </div>

                  {/* Mobile Notifications Dropdown */}
                  <div className="mobile-notifications" style={{ marginTop: '10px' }}>
                    {notifications.length > 0 && notifications.map(n => (
                      <div key={n.id} style={{ fontSize: '0.8rem', padding: '5px', borderBottom: '1px solid #444', color: '#ccc' }}>
                        {n.message}
                      </div>
                    ))}
                  </div>
                </nav>
                <div className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  <i className={`fas ${isMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
                </div>
              </header>




              <section className="hero" id="home" style={{ backgroundImage: `linear-gradient(rgba(31, 60, 88, 0.3), rgba(158, 42, 47, 0.3)), url('${siteData.images.heroBg}')` }}>
                <h2 className="reveal">وتهفو الروح شوقاً نحو مكة</h2>
                <p className="reveal">خدمات حج وعمرة متميزة - تذاكر طيران لجميع أنحاء العالم - تأشيرات سريعة</p>
                <div className="hero-btns reveal">
                  <button className="btn-umrah" onClick={() => openModal('باقة العمرة')} style={{ minWidth: '160px' }}>
                    <i className="fas fa-kaaba" style={{ marginLeft: '8px' }}></i> باقات العمرة
                  </button>
                  <button className="btn-hajj" onClick={() => openModal('باقة الحج')} style={{ minWidth: '160px' }}>
                    <i className="fas fa-mosque" style={{ marginLeft: '8px' }}></i> باقات الحج
                  </button>
                  <button className="btn-main" onClick={() => document.getElementById('services').scrollIntoView()} style={{ minWidth: '160px' }}>
                    <i className="fas fa-concierge-bell" style={{ marginLeft: '8px' }}></i> خدماتنا
                  </button>
                </div>
              </section>

              <div className="stats-bar reveal" ref={statsRef}>
                <div className="stat-item"><i className="stat-icon fas fa-calendar-check"></i><span className="stat-number">{counts.exp}+</span><span className="stat-label">سنوات خبرة</span></div>
                <div className="stat-item"><i className="stat-icon fas fa-users"></i><span className="stat-number">{counts.pilgrims}+</span><span className="stat-label">معتمر</span></div>
                <div className="stat-item"><i className="stat-icon fas fa-plane"></i><span className="stat-number">{counts.destinations}+</span><span className="stat-label">وجهة</span></div>
                <div className="stat-item"><i className="stat-icon fas fa-headset"></i><span className="stat-number">{counts.support}</span><span className="stat-label">دعم فني</span></div>
              </div>

              {/* User Account Quick Access Card */}
              <div className="user-account-section reveal" style={{
                padding: '40px 5%',
                background: 'var(--bg-light)'
              }}>
                <div style={{
                  maxWidth: '1200px',
                  margin: '0 auto',
                  background: 'linear-gradient(135deg, #1f3c58 0%, #9e2a2f 100%)',
                  borderRadius: '20px',
                  padding: '50px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Decorative Elements */}
                  <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '200px',
                    height: '200px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%',
                    filter: 'blur(60px)'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-30px',
                    left: '-30px',
                    width: '150px',
                    height: '150px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '50%',
                    filter: 'blur(40px)'
                  }}></div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '30px',
                    position: 'relative',
                    zIndex: 1
                  }}>
                    {/* User Profile Card */}
                    <div onClick={() => navigate('/dashboard')} style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '15px',
                      padding: '30px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      textAlign: 'center'
                    }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                      }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        margin: '0 auto 20px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 30px rgba(212, 175, 55, 0.4)'
                      }}>
                        <i className="fas fa-user-circle" style={{
                          fontSize: '3rem',
                          color: 'white'
                        }}></i>
                      </div>
                      <h3 style={{
                        color: 'white',
                        fontSize: '1.4rem',
                        marginBottom: '10px',
                        fontFamily: 'Amiri, serif'
                      }}>
                        {currentUser?.name || 'مستخدم'}
                      </h3>
                      <p style={{
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '0.9rem',
                        marginBottom: '15px'
                      }}>
                        {currentUser?.account_type === 'company' ? '🏢 حساب شركة' : '👤 حساب فردي'}
                      </p>
                      <button style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        border: '2px solid rgba(255, 255, 255, 0.4)',
                        padding: '10px 25px',
                        borderRadius: '25px',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.color = 'var(--primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                          e.currentTarget.style.color = 'white';
                        }}>
                        <i className="fas fa-tachometer-alt" style={{ marginLeft: '8px' }}></i>
                        لوحة التحكم
                      </button>
                    </div>

                    {/* Quick Stats */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '15px',
                      padding: '30px',
                      border: '2px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <h4 style={{
                        color: 'white',
                        fontSize: '1.2rem',
                        marginBottom: '20px',
                        fontFamily: 'Amiri, serif'
                      }}>
                        <i className="fas fa-chart-line" style={{ marginLeft: '10px' }}></i>
                        إحصائياتك السريعة
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px'
                        }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                            <i className="fas fa-ticket-alt" style={{ marginLeft: '8px', color: '#FFD700' }}></i>
                            الحجوزات
                          </span>
                          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>0</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px'
                        }}>
                          <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                            <i className="fas fa-bell" style={{ marginLeft: '8px', color: '#FFD700' }}></i>
                            الإشعارات
                          </span>
                          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>{unreadCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '15px',
                      padding: '30px',
                      border: '2px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <h4 style={{
                        color: 'white',
                        fontSize: '1.2rem',
                        marginBottom: '20px',
                        fontFamily: 'Amiri, serif'
                      }}>
                        <i className="fas fa-bolt" style={{ marginLeft: '10px' }}></i>
                        إجراءات سريعة
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button onClick={() => navigate('/pilgrims')} style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: '10px',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          textAlign: 'right',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}>
                          <span>متابعة المعتمرين</span>
                          <i className="fas fa-users"></i>
                        </button>
                        <button onClick={() => openModal('باقة العمرة')} style={{
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          border: 'none',
                          padding: '12px 20px',
                          borderRadius: '10px',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          textAlign: 'right',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}>
                          <span>حجز جديد</span>
                          <i className="fas fa-plus-circle"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="partners-section">
                <div className="partners-track">
                  {[1, 2, 3, 4].map((_, i) => (
                    <>
                      <div className="partner-item"><i className="fas fa-plane"></i> اليمنية</div>
                      <div className="partner-item"><i className="fas fa-plane"></i> السعودية</div>
                      <div className="partner-item"><i className="fas fa-plane"></i> القطرية</div>
                      <div className="partner-item"><i className="fas fa-plane"></i> الإماراتية</div>
                      <div className="partner-item"><i className="fas fa-bus"></i> النقل الجماعي</div>
                    </>
                  ))}
                </div>
              </div>

              <section className="section-padding about-section">
                <div className="about-img reveal"><img src={siteData.images.aboutImg} alt="About Us" /></div>
                <div className="about-text reveal">
                  <h3>ريادة في عالم السفر</h3>
                  <p>تأسست الكويت للسفريات والسياحة لتكون الخيار الأول للمسافر اليمني. نقدم حلول دفع إلكترونية حديثة لتسهيل حجوزاتكم.</p>
                  <button className="btn-main" onClick={() => window.open(`https://wa.me/${siteData.contact.whatsapp}`, '_blank')}>تواصل معنا</button>
                </div>
              </section>

              <section className="section-padding" id="services" style={{ background: 'var(--bg-light)' }}>
                <div className="section-header services-header reveal"><h2>خدماتنا المتميزة</h2><p>حلول سفر متكاملة ودفع إلكتروني آمن</p></div>
                <div className="services-grid">
                  <div className="service-card" onClick={() => openModal('جوازات السفر')}><div className="service-icon"><i className="fas fa-passport"></i></div><h3>جوازات السفر</h3><p>استخراج وتجديد جوازات السفر بسرعة.</p></div>
                  <div className="service-card" onClick={() => openModal('البطائق الشخصية')}><div className="service-icon"><i className="fas fa-id-badge"></i></div><h3>البطائق الشخصية</h3><p>خدمة استخراج البطائق الشخصية.</p></div>
                  <div className="service-card" onClick={() => openModal('حجوزات طيران')}><div className="service-icon"><i className="fas fa-plane-departure"></i></div><h3>حجوزات طيران</h3><p>لجميع الوجهات العالمية.</p></div>
                  <div className="service-card" onClick={() => openModal('حج وعمرة')}><div className="service-icon"><i className="fas fa-kaaba"></i></div><h3>حج وعمرة</h3><p>باقات شاملة وميسرة.</p></div>
                  <div className="service-card" onClick={() => openModal('تأشيرات')}><div className="service-icon"><i className="fas fa-globe"></i></div><h3>تأشيرات</h3><p>تخليص سريع ومضمون.</p></div>
                  <div className="service-card"><div className="service-icon"><i className="fas fa-credit-card"></i></div><h3>دفع إلكتروني</h3><p>نقبل جميع البطاقات البنكية.</p></div>
                </div>
              </section>

              <div className="hajj-section" id="hajj">
                <div className="hajj-content reveal">
                  <span className="hajj-subtitle">لبيك اللهم لبيك</span>
                  <h2 className="hajj-title">باقات الحج والعمرة</h2>
                  <p className="hajj-desc">باقات متكاملة تشمل التأشيرة، السكن، والنقل. ادفع الآن إلكترونياً واحجز مقعدك فوراً.</p>
                  <ul className="hajj-features">
                    <li><i className="fas fa-check"></i> باقات حج فاخرة واقتصادية</li>
                    <li><i className="fas fa-check"></i> إصدار تأشيرات عمرة إلكترونية فورية</li>
                    <li><i className="fas fa-check"></i> فنادق قريبة من الحرم</li>
                  </ul>
                  <div className="hajj-actions">
                    <button className="btn-umrah" onClick={() => openModal('باقة العمرة')}>حجز عمرة</button>
                    <button className="btn-hajj" onClick={() => openModal('باقة الحج')}>حجز حج</button>
                  </div>
                </div>
                <div className="hajj-image reveal" style={{ backgroundImage: `url('${siteData.images.hajjSection}')` }}></div>
              </div>

              <section className="section-padding" id="packages">
                <div className="section-header"><h2>عروضنا الحصرية</h2><p>ادفع ببطاقتك وسافر فوراً</p></div>
                <div className="offers-grid">
                  {destinations && destinations.map((dest, index) => (
                    <div
                      className="offer-card"
                      key={dest.id}
                      onClick={() => openModal(dest.title)}
                      style={{
                        cursor: 'pointer',
                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                        border: '1px solid #eee',
                        background: 'var(--white)',
                        overflow: 'hidden',
                        borderRadius: '15px'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-10px)';
                        e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div className="offer-img-box" style={{
                        height: '220px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <span className="price-badge">{dest.price}</span>
                        <img src={dest.image} alt={dest.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div className="offer-details" style={{ padding: '20px' }}>
                        <h3 className="offer-title" style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: 'var(--primary)' }}>{dest.title}</h3>
                        <p style={{ color: '#777', fontSize: '0.9rem', marginBottom: '15px' }}>استمتع برحلة لا تنسى مع خدماتنا المتميزة.</p>
                        <button className="btn-book" style={{ width: '100%' }} onClick={(e) => {
                          e.stopPropagation();
                          openModal(dest.title);
                        }}>احجز الآن</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="section-padding" style={{ background: 'var(--bg-light)' }}>
                <div className="section-header reveal"><h2>معرض الصور</h2></div>
                <div className="gallery-grid reveal">
                  <div className="gallery-item"><img src={siteData.images.gallery1} alt="Makkah" /><div className="gallery-overlay">مكة المكرمة</div></div>
                  <div className="gallery-item"><img src={siteData.images.gallery2} alt="Madinah" /><div className="gallery-overlay">المدينة المنورة</div></div>
                  <div className="gallery-item"><img src={siteData.images.gallery3} alt="Bus" /><div className="gallery-overlay">باصات النقل</div></div>
                  <div className="gallery-item"><img src={siteData.images.gallery4} alt="Hotel" /><div className="gallery-overlay">الفنادق</div></div>
                </div>
              </section>

              <section className="section-padding">
                <div className="section-header reveal"><h2>التأشيرات</h2></div>
                <div className="visa-grid reveal">
                  <div className="visa-item" onClick={() => openModal('تأشيرة السعودية')}><div className="visa-flag" style={{ backgroundImage: `url('${siteData.images.flagSA}')` }}></div><h4>السعودية</h4></div>
                  <div className="visa-item" onClick={() => openModal('تأشيرة الإمارات')}><div className="visa-flag" style={{ backgroundImage: `url('${siteData.images.flagAE}')` }}></div><h4>الإمارات</h4></div>
                  <div className="visa-item" onClick={() => openModal('تأشيرة مصر')}><div className="visa-flag" style={{ backgroundImage: `url('${siteData.images.flagEG}')` }}></div><h4>مصر</h4></div>
                  <div className="visa-item" onClick={() => openModal('تأشيرة الأردن')}><div className="visa-flag" style={{ backgroundImage: `url('${siteData.images.flagJO}')` }}></div><h4>الأردن</h4></div>
                  <div className="visa-item" onClick={() => openModal('تأشيرة تركيا')}><div className="visa-flag" style={{ backgroundImage: `url('${siteData.images.flagTR}')` }}></div><h4>تركيا</h4></div>
                </div>
              </section>

              <section className="section-padding" id="contact" style={{ background: 'var(--bg-light)' }}>
                <div className="section-header reveal"><h2>تواصل معنا</h2></div>
                <div className="contact-container reveal">
                  <div className="contact-form">
                    <h3 style={{ color: 'var(--secondary)', marginBottom: '20px' }}>أرسل لنا رسالة</h3>
                    <form onSubmit={handleContactSubmit}>
                      <input type="text" className="form-control" placeholder="الاسم" required />
                      <input type="tel" className="form-control" placeholder="رقم الهاتف" required />
                      <textarea className="form-control" rows="4" placeholder="الرسالة"></textarea>
                      <button type="submit" className="btn-send">
                        <i className="fas fa-paper-plane"></i> إرسال
                      </button>
                    </form>
                  </div>
                  <div className="contact-map">
                    <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3847.8!2d44.19!3d15.33!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTXCsDE5JzQ4LjAiTiA0NMKwMTEnMjQuMCJF!5e0!3m2!1sar!2s!4v1600000000000" width="100%" height="100%" style={{ border: 0 }} allowFullScreen="" loading="lazy"></iframe>
                  </div>
                </div>
              </section>

              <footer>
                <div className="footer-grid">
                  <div className="footer-col"><h3>الكويت للسفريات</h3><p>وكالة رائدة في خدمات السفر والسياحة. نقبل الدفع الإلكتروني.</p></div>
                  <div className="footer-col">
                    <h3>تواصل معنا</h3>
                    <ul className="footer-contact">
                      <li><i className="fas fa-map-marker-alt"></i> صنعاء - الستين الشمالي</li>
                      <li><i className="fas fa-phone-alt"></i> {siteData.contact.phone1}</li>
                      <li><i className="fas fa-envelope"></i> alkuwaitagency2019@gmail.com</li>
                    </ul>
                  </div>
                  <div className="footer-col" style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '20px' }}>
                    <a href="/terms" style={{ color: '#aaa', fontSize: '0.9rem' }}>الشروط والأحكام وسياسة الخصوصية</a>
                  </div>
                </div>
                <div style={{ textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #333' }}>جميع الحقوق محفوظة © 2025 الكويت للسفريات</div>
              </footer>

              <a href={`https://wa.me/${siteData.contact.whatsapp}`} className="whatsapp-float" target="_blank" rel="noreferrer"><i className="fab fa-whatsapp"></i></a>

              {
                modalOpen && (
                  <div className="modal-overlay" onClick={(e) => { if (e.target.className === 'modal-overlay') closeModal() }}>
                    <div className="modal-content">
                      <span className="close-modal" onClick={closeModal}>&times;</span>

                      {modalStep === 1 && (
                        <div className="step-container active">
                          <h3 style={{ color: 'var(--primary)', textAlign: 'center', marginBottom: '20px' }}>{selectedService}</h3>
                          <form onSubmit={handleBookingSubmit}>
                            <input type="text" className="form-control" placeholder="الاسم الثلاثي" required
                              value={bookingData.name} onChange={(e) => setBookingData({ ...bookingData, name: e.target.value })} />
                            <input type="tel" className="form-control" placeholder="رقم الهاتف" required
                              value={bookingData.phone} onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })} />
                            <input type="number" className="form-control" placeholder="عدد الأشخاص" min="1" required
                              value={bookingData.people} onChange={(e) => setBookingData({ ...bookingData, people: e.target.value })} />

                            {(selectedService.includes('حج') || selectedService.includes('عمرة') || selectedService.includes('تأشير') || selectedService.includes('طيران') || selectedService.includes('سفر') || selectedService.includes('مكة') || selectedService.includes('المدينة') || selectedService.includes('تركيا') || selectedService.includes('مصر') || selectedService.includes('ماليزيا') || selectedService.includes('دبي') || selectedService.includes('الرياض')) && (
                              <>
                                <input type="text" className="form-control" placeholder="الدولة / الوجهة" required
                                  value={bookingData.destination} onChange={(e) => setBookingData({ ...bookingData, destination: e.target.value })} />

                                <input type="number" className="form-control" placeholder="عدد الأيام" required
                                  value={bookingData.days} onChange={(e) => setBookingData({ ...bookingData, days: e.target.value })} />

                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>نوع الباقة:</label>
                                <select className="form-control" value={bookingData.packageType} onChange={(e) => setBookingData({ ...bookingData, packageType: e.target.value })}>
                                  <option value="Economic">اقتصادية</option>
                                  <option value="Golden">ذهبية</option>
                                  <option value="VIP">VIP</option>
                                </select>

                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>طريقة السفر:</label>
                                <select className="form-control" value={bookingData.travelMethod} onChange={(e) => setBookingData({ ...bookingData, travelMethod: e.target.value })}>
                                  <option value="Air">طيران</option>
                                  <option value="Land">بر (باص)</option>
                                  <option value="Sea">بحر</option>
                                </select>

                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>صورة الجواز:</label>
                                <input type="file" className="form-control" accept="image/*"
                                  onChange={(e) => setBookingData({ ...bookingData, passport: e.target.files[0] })} />
                              </>

                            )}

                            {(selectedService === 'جوازات السفر' || selectedService === 'البطائق الشخصية') && (
                              <>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  <input type="number" className="form-control" placeholder="العمر" required style={{ flex: 1 }}
                                    value={bookingData.age} onChange={(e) => setBookingData({ ...bookingData, age: e.target.value })} />
                                  <input type="text" className="form-control" placeholder="مكان الميلاد" required style={{ flex: 1 }}
                                    value={bookingData.birthPlace} onChange={(e) => setBookingData({ ...bookingData, birthPlace: e.target.value })} />
                                </div>

                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>تاريخ الميلاد:</label>
                                <input type="date" className="form-control" required
                                  value={bookingData.dob} onChange={(e) => setBookingData({ ...bookingData, dob: e.target.value })} />

                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>نوع المعاملة:</label>
                                <select className="form-control" value={bookingData.serviceSubtype} onChange={(e) => setBookingData({ ...bookingData, serviceSubtype: e.target.value })}>
                                  <option value="new">أول مرة</option>
                                  <option value="renewal">تجديد</option>
                                  <option value="replacement">بدل فاقد</option>
                                  <option value="damaged">بدل تالف</option>
                                </select>

                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>رفع الوثائق (صورة البطاقة/الجواز):</label>
                                <input type="file" className="form-control" accept="image/*" required
                                  onChange={(e) => setBookingData({ ...bookingData, passport: e.target.files[0] })} />
                              </>
                            )}

                            <textarea className="form-control" placeholder="تفاصيل الطلب (اختياري)" rows="3"
                              value={bookingData.notes} onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}></textarea>

                            {/* Payment Section - Now Inline */}
                            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />
                            <h3 style={{ color: 'var(--secondary)', textAlign: 'center', marginBottom: '20px' }}>خيارات الدفع</h3>

                            <div className="payment-options" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                              <button type="button"
                                className={`btn-main ${bookingData.paymentMethod !== 'card' ? 'outline' : ''}`}
                                onClick={() => setBookingData({ ...bookingData, paymentMethod: 'card' })}
                                style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }}>
                                بطاقة
                              </button>
                              <button type="button"
                                className={`btn-main ${bookingData.paymentMethod !== 'bank' ? 'outline' : ''}`}
                                onClick={() => setBookingData({ ...bookingData, paymentMethod: 'bank' })}
                                style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }}>
                                تحويل بنكي
                              </button>
                              <button type="button"
                                className={`btn-main ${bookingData.paymentMethod !== 'later' ? 'outline' : ''}`}
                                onClick={() => setBookingData({ ...bookingData, paymentMethod: 'later' })}
                                style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }}>
                                دفع لاحقاً
                              </button>
                            </div>

                            {bookingData.paymentMethod === 'card' && (
                              <div className="payment-method-content">
                                <div className="payment-icons">
                                  <i className="fab fa-cc-visa"></i>
                                  <i className="fab fa-cc-mastercard"></i>
                                  <i className="fas fa-credit-card"></i>
                                </div>
                                <div className="card-input-container">
                                  <input type="text" className="form-control card-input" placeholder="رقم البطاقة" maxLength="19" />
                                  <i className="fas fa-lock card-input-icon"></i>
                                </div>
                                <div className="card-row">
                                  <input type="text" className="form-control" placeholder="MM/YY" maxLength="5" style={{ flex: 1 }} />
                                  <input type="text" className="form-control" placeholder="CVC" maxLength="3" style={{ flex: 1 }} />
                                </div>
                                <input type="text" className="form-control" placeholder="اسم حامل البطاقة" />
                              </div>
                            )}

                            {bookingData.paymentMethod === 'bank' && (
                              <div className="payment-method-content" style={{ textAlign: 'center', padding: '20px', background: '#f9f9f9', borderRadius: '8px', marginBottom: '20px' }}>
                                <h4>حساباتنا البنكية</h4>
                                <p style={{ margin: '10px 0' }}><strong>بنك الكريمي:</strong> 123456789</p>
                                <p style={{ margin: '10px 0' }}><strong>بنك التضامن:</strong> 987654321</p>
                                <hr style={{ margin: '15px 0' }} />
                                <p style={{ fontSize: 'small', color: '#666' }}>يرجى إرسال إشعار التحويل إلى الواتساب مع رقم الحجز</p>
                              </div>
                            )}

                            {bookingData.paymentMethod === 'later' && (
                              <div className="payment-method-content" style={{ textAlign: 'center', padding: '20px', background: '#f9f9f9', borderRadius: '8px', marginBottom: '20px' }}>
                                <i className="fas fa-headset" style={{ fontSize: '2rem', color: 'var(--primary)', marginBottom: '10px' }}></i>
                                <h4>الدفع عبر خدمة العملاء</h4>
                                <p>سيقوم فريقنا بالتواصل معك لتأكيد الحجز وترتيب طريقة الدفع المناسبة.</p>
                              </div>
                            )}

                            <button type="submit" className="btn-main" style={{ width: '100%', marginTop: '20px', background: '#28a745' }}>
                              {bookingData.paymentMethod === 'card' ? 'دفع وتأكيد الحجز' : 'تأكيد الحجز'}
                            </button>
                          </form>
                        </div>
                      )}

                      {modalStep === 'processing' && (
                        <div className="step-container active processing-view">
                          <div className="spinner"></div>
                          <h4>جاري معالجة الدفع...</h4>
                          <p>يرجى عدم إغلاق الصفحة</p>
                        </div>
                      )}

                      {modalStep === 'success' && (
                        <div className="step-container active success-view">
                          <i className="fas fa-check-circle success-icon"></i>
                          <h3 style={{ color: 'var(--success)' }}>تم الدفع بنجاح!</h3>
                          <p>رقم الحجز: <span style={{ fontWeight: 'bold', color: '#333' }}>#KW8923</span></p>
                          <p>تم إرسال تفاصيل الحجز إلى هاتفك.</p>
                          <button onClick={closeModal} className="btn-main" style={{ marginTop: '20px' }}>إغلاق</button>
                        </div>
                      )}

                    </div>
                  </div>
                )}

              {/* Footer placed correctly at bottom */}
              <footer>
                <div className="footer-grid">
                  <div className="footer-col">
                    <h3 className="footer-title">عن الشركة</h3>
                    <p>الكويت للسفريات والسياحة، خيارك الأول للسفر والسياحة. خدمات متميزة وأسعار منافسة.</p>
                  </div>
                  <div className="footer-col">
                    <h3 className="footer-title">روابط سريعة</h3>
                    <ul className="footer-links">
                      <li><a href="#hero">الرئيسية</a></li>
                      <li><a href="#services">خدماتنا</a></li>
                      <li><a href="#packages">العروض</a></li>
                      {!isLoggedIn && (
                        <li><a href="#" onClick={(e) => { e.preventDefault(); setShowLoginModal(true); }}>
                          <i className="fas fa-sign-in-alt" style={{ marginLeft: '5px', color: 'var(--accent)' }}></i>
                          تسجيل الدخول للموظفين
                        </a></li>
                      )}
                    </ul>
                  </div>
                  <div className="footer-col">
                    <h3 className="footer-title">تواصل معنا</h3>
                    <ul className="footer-contact">
                      <li><i className="fas fa-phone"></i> 776358963</li>
                      <li><i className="fab fa-whatsapp"></i> 967776358963</li>
                      <li><i className="fas fa-envelope"></i> info@kuwait-travel.com</li>
                    </ul>
                  </div>
                </div>
                <div className="footer-bottom" style={{ textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #333' }}>
                  <p>جميع الحقوق محفوظة &copy; 2026 الكويت للسفريات</p>
                </div>
              </footer>
            </div>
          )} />
      </Routes >
      {/* Custom Notification Component */}
      {
        notification.visible && (
          <div className={`custom-notification ${notification.type}`}>
            <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            <span>{notification.message}</span>
          </div>
        )
      }
    </>
  );
}

export default App;
