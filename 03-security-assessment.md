# 3 - Security Assessment

[← العودة إلى الفصل 2: System Architecture](02-system-architecture.md) | [الفصل التالي: System Hardening →](04-system-hardening.md)

---

## 3.1 Overview (نظرة عامة على التقييم الأمني)

قبل الشروع في عمليات التصليب الأمني (Hardening)، تم إجراء فحص وتدقيق أمني شامل للقراءة فقط (Read-Only Security Assessment & Code Audit) على الشيفرة المصدرية لمنصة **Kuwait Travel & Tourism Platform**. كان الهدف الأساسي هو تحديد العيوب البنيوية، الثغرات البرمجية، والمشكلات المعمارية دون إحداث أية تعديلات غير مدروسة قد تعطل الوظائف الحالية للتطبيق.

تم تقييم المنصة بناءً على معايير **OWASP Top 10 Web Application Security Risks** (وبالأخص ثغرات Broken Access Control، Identification & Authentication Failures، Security Misconfiguration، و Cryptographic Failures)، إلى جانب معايير الاستقرار التشغيلي الهندسي.

---

## 3.2 Comprehensive Findings Matrix (مصفوفة النتائج الشاملة)

أسفر التدقيق عن اكتشاف أحد عشر بنداً موزعة بين عيوب هندسية تشغيلية وثغرات أمنية:

### العيوب الهندسية والتشغيلية (Engineering & Reliability Defects)

| المعرف (ID) | نطاق المشكلة (Area) | وصف المشكلة (Finding) | الخطورة (Severity) | الحالة المبدئية (Initial Status) | الحالة بعد المعالجة (Remediated Status) |
|---|---|---|:---:|:---:|:---:|
| **BUG-001** | Data Persistence | مسح وحذف سجلات المعتمرين عند كل إعادة تشغيل للخادم | High | Verified Vulnerable | **REMEDIATED** |
| **BUG-002** | Schema Integrity | غياب جدول `alerts` مما يتسبب في خطأ 500 عند فحص التنبيهات | Medium | Verified Vulnerable | **REMEDIATED** |
| **BUG-003** | Database Paths | تشتت مسارات قواعد بيانات SQLite الناتجة عن المسارات النسبية | Medium | Verified Vulnerable | **REMEDIATED** |
| **BUG-004** | Module Lifecycle | تعطل تهيئة مزودي الذكاء الاصطناعي بسبب Hoisting في ES Modules | Medium | Verified Vulnerable | **REMEDIATED** |
| **BUG-005** | Credential Hygiene | تضمين مفاتيح Google API بصورة صريحة في الكود المصدري | High | Verified Vulnerable | **REMEDIATED** |

### ثغرات أمن التطبيقات (Application Security Vulnerabilities)

| المعرف (ID) | نطاق المشكلة (Area) | وصف الثغرة (Finding) | الخطورة (Severity) | الحالة المبدئية (Initial Status) | الحالة بعد المعالجة (Remediated Status) |
|---|---|---|:---:|:---:|:---:|
| **SEC-01** | Credential Storage | تخزين ومقارنة كلمات المرور كنص صريح (Plaintext Passwords) | **CRITICAL** | Verified Vulnerable | **REMEDIATED** |
| **SEC-02** | Access Control | غياب تام لآليات Authorization و Authentication في خادم Backend | **CRITICAL** | Verified Vulnerable | **REMEDIATED** |
| **SEC-03** | Authorization (BOLA) | استرجاع البيانات بالاعتماد على معرفات العميل (BOLA / IDOR) | **HIGH** | Verified Vulnerable | **REMEDIATED** |
| **SEC-04** | File Upload Security | رفع ملفات غير مقيد ودون فحص الامتداد أو الحجم أو Magic Bytes | **HIGH** | Verified Vulnerable | **REMEDIATED** |
| **SEC-06** | Availability / DoS | تعارض محدد معدل الطلبات (Rate Limiting) مع استعلام الإشعارات | **MEDIUM** | Verified Present | *Pending Refactor* |
| **SEC-07** | Network Policy | سياسة CORS عامة بدون تقييد للنطاقات المسموح بها | **LOW** | Verified Present | *Pending Refactor* |

---

## 3.3 Detailed Security Findings Analysis (تحليل الثغرات الأمنية المفصل)

---

### [SEC-01] Stored Plaintext Passwords (تخزين كلمات المرور كنص صريح)

- **الخطورة (Severity):** **CRITICAL** (مستوى CVSS: 9.8)
- **المسارات المتأثرة (Affected Endpoints):** `POST /api/register`, `POST /api/login`, `server/seedAgents.js`, `server/create_admin.js`

#### Problem (وصف المشكلة)
يتم تخزين كلمات المرور لجميع حسابات النظام (المستخدمين العاديين، وكلاء السفر، ومديري النظام) كنصوص صريحة غير مشفرة (Plaintext Strings) داخل جدول `users` في قاعدة بيانات `auth.sqlite`. وأثناء محاولة تسجيل الدخول، ينفذ الخادم عملية مقارنة نصية مجردة (`user.password !== password`).

#### Root Cause (السبب الجذري)
تم إغفال تطبيق خوارزمية تجزئة وتشفير لكلمات المرور أثناء بناء النموذج الأولي. وكان كود التسجيل يُدرج النص القادم من العميل مباشرة إلى قاعدة البيانات:
```javascript
// كود النموذج الأولي غير الآمن
await authDb.run(
    "INSERT INTO users (name, email, password, phone, account_type) VALUES (?, ?, ?, ?, ?)",
    [name, email, password, phone, account_type]
);
```

#### Impact (الأثر والمخاطر)
أي تسريب لملف قاعدة البيانات `auth.sqlite` (سواء عبر Directory Traversal، أو عبر النسخ الاحتياطية غير المحمية، أو عبر الوصول المادي) يكشف على الفور كافة كلمات المرور لجميع مستخدمي ومديري النظام.

#### Remediation Direction (مسار المعالجة الهندسية)
ترحيل كافة كلمات المرور الحالية إلى خوارزمية التجزئة المعيارية `bcrypt` مع Salt و Cost Factor 10. وتعديل نقاط نهاية التسجيل لتشفير كلمات المرور قبل حفظها، واستخدام `bcrypt.compare` للمقارنة في تسجيل الدخول.

---

### [SEC-02] Complete Lack of Server-Side Authorization (غياب التفويض في الخادم)

- **الخطورة (Severity):** **CRITICAL** (مستوى CVSS: 9.1)
- **المسارات المتأثرة (Affected Endpoints):** كافة المسارات الإدارية (`/api/admin/*`)، والمسارات التشغيلية للمعتمرين (`/api/pilgrims/*`)

#### Problem (وصف المشكلة)
يعتمد التطبيق في التحقق من الصلاحيات والتحكم بالوصول (Access Control) على الواجهة الأمامية فقط من خلال إخفاء أو إظهار أزرار التنقل في واجهة React. في حين أن مسارات Express API في الواجهة الخلفية مفتوحة بالكامل أمام أي طلب HTTP دون أي فحص للمصادقة أو للرتبة والصلاحية.

#### Root Cause (السبب الجذري)
انعدام وجود طبقة وسطية (Middleware) للتحقق من هوية وصلاحية الطالب على مسارات الخادم؛ حيث تم ربط المتحكمات البرمجية مباشرة دون حراسة أمنية:
```javascript
// مسار إداري مفتوح تماماً وبلا حماية في الكود المبدئي
app.get('/api/admin/users', async (req, res) => {
    const users = await authDb.all("SELECT id, name, email, phone, role FROM users");
    res.json(users);
});
```
بمجرد إرسال طلب `GET http://localhost:5000/api/admin/users` بواسطة أي أداة استدعاء خارجية، كان الخادم يعيد قائمة بجميع الحسابات المسجلة وأرقام الهواتف والأدوار الإدارية.

#### Impact (الأثر والمخاطر)
تمكين أي جهة خارجية غير مسجلة من قراءة البيانات الحساسة للمستخدمين، تعديل الحجوزات، حذف رسائل العملاء، أو حتى ترقية أي حساب عادي إلى مدير نظام بكامل الصلاحيات (`PUT /api/admin/users/:id/role`).

#### Remediation Direction (مسار المعالجة الهندسية)
بناء معمارية مصادقة تعتمد على رموز JWT مشفرة ومحفوظة داخل HttpOnly Cookies، مع تطبيق طبقات Middleware متعددة الصلاحيات (`verifyToken`, `requireAdmin`, `requireAgent`) وحماية متقدمة ضد هجمات التزوير عبر `verifyCsrf`.

---

### [SEC-03] Broken Object Level Authorization (BOLA / IDOR)

- **الخطورة (Severity):** **HIGH** (مستوى CVSS: 8.5)
- **المسارات المتأثرة (Affected Endpoints):** `GET /api/my-bookings`, `GET /api/notifications`, `POST /api/notifications/read`, `GET /api/pilgrims`, `GET /api/pilgrims/export-pdf`

#### Problem (وصف المشكلة)
تعتمد مسارات استرجاع البيانات الشخصية والتشغيلية على المعرفات المرسلة كمعاملات استعلام (Query Parameters) مثل رقم الهاتف `phone` أو معرف الوكيل `agent_id`، بدلاً من استخراج الهوية حصرياً من جلسة المستخدم الموثقة.

#### Root Cause (السبب الجذري)
وثوق الواجهة الخلفية في المدخلات التي يحددها العميل للوصول إلى السجلات المخزنة:
```javascript
// كود مبدئي يثق برقم الهاتف القادم من العميل
app.get('/api/my-bookings', async (req, res) => {
    const { phone } = req.query;
    const rows = await dataDb.all("SELECT * FROM bookings WHERE phone = ?", [phone]);
    res.json(rows);
});
```

#### Impact (الأثر والمخاطر)
قدرة أي مستخدم على قراءة الحجوزات ومسارات صور الجوازات وتواريخ السفر الخاصة بأي عميل آخر بمجرد تخمين أو معرفة رقم هاتفه. بالإضافة إلى قدرة أي وكيل سفر على استعراض أو تصدير قوائم المعتمرين التابعين لوكلاء منافسين بمجرد تغيير قيمة المعامل `agent_id`.

#### Remediation Direction (مسار المعالجة الهندسية)
إلغاء الاعتماد على المعرفات القادمة من العميل؛ واستبدالها بالربط الصارم بهوية المستخدم المستخرجة من التوكن المفكك تشفيره في الخادم (`req.user.id`)، مع فرض قيود صارمة على أية محاولة للاستعلام عن بيانات مستخدم آخر.

---

### [SEC-04] Unrestricted Arbitrary File Upload (رفع الملفات غير المقيد)

- **الخطورة (Severity):** **HIGH** (مستوى CVSS: 8.2)
- **المسارات المتأثرة (Affected Endpoints):** `POST /api/bookings` (رفع صور ومستندات الجوازات)

#### Problem (وصف المشكلة)
يقبل مسار رفع وثائق السفر ملفات بأحجام غير محدودة وأي امتدادات دون تدقيق. ويتم حفظ الملفات في مجلد محلي متاح مباشرة للوصول العام عبر المتصفح دون مصادقة: `app.use('/uploads', express.static('uploads'))`.

#### Root Cause (السبب الجذري)
تهيئة مكتبة Multer بالإعدادات الافتراضية دون وضع قيود الحجم (`limits`) ودون مرشح الامتدادات (`fileFilter`)، والوثوق بالامتداد القادم من اسم الملف الأصلي:
```javascript
// تهيئة Multer الأولية المفتوحة دون قيود
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });
```

#### Impact (الأثر والمخاطر)
إمكانية رفع ملفات تنفيذية ضارة، أو ملفات HTML/SVG تحتوي على أكواد خبيثة لتنفيذ هجمات Stored XSS، أو رفع ملفات ضخمة تؤدي لامتلاء مساحة التخزين على الخادم (Disk Exhaustion DoS)، فضلاً عن إمكانية الوصول لوثائق الجوازات الخاصة بالعملاء عبر روابط الإنترنت المباشرة.

#### Remediation Direction (مسار المعالجة الهندسية)
1. وضع سقف حجم صارم لا يتجاوز 5 MB.
2. حصر الامتدادات المقبولة في قائمة بيضاء (`.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`).
3. التحقق الصارم من ترويسة نوع المحتوى (MIME Type).
4. فحص التواقيع الثنائية الحقيقية للملفات (Magic Bytes) لكشف وتدمير الملفات المزيفة.
5. استبدال أسماء الملفات بأسماء عشوائية آمنة مشفرة تمنع Path Traversal.
6. حماية مجلد `/uploads` بـ `verifyToken` لمنع الوصول غير المصرح به.

---

### [SEC-06] Denial of Service Risk via Rate Limiter Misconfiguration

- **الخطورة (Severity):** **MEDIUM** (مستوى CVSS: 5.3)
- **النطاق المتأثر (Affected Area):** تضارب الـ Global Rate Limiter مع كود فحص الإشعارات في الواجهة الأمامية

#### Problem (وصف المشكلة)
تم ضبط محدد معدل الطلبات في `server/index.js` بسقف 100 طلب لكل 15 دقيقة عالمياً لكافة المسارات. في المقابل، تقوم واجهة `App.jsx` بالاستعلام الدوري عن الإشعارات كل 10 ثوانٍ عبر `setInterval`.

#### Root Cause (السبب الجذري)
فحص الإشعارات كل 10 ثوانٍ يولد 6 طلبات بالدقيقة، أي 90 طلباً خلال 15 دقيقة للإشعارات فقط، مما يجعل المستخدم النشط يستهلك الحصة المتاحة له بالكامل في غضون 10 إلى 12 دقيقة، ويتم حظره برمز `HTTP 429 Too Many Requests`.

#### Current Status (الحالة الحالية)
تم توثيق المشكلة كـ Known Architectural Limitation، وسيتم في التحديث المستقبلي عزل مسارات الاستعلام عن محدد الطلبات العام واستبدال Polling بتقنيات WebSockets أو Server-Sent Events (SSE).

---

### [SEC-07] Wildcard CORS Configuration

- **الخطورة (Severity):** **LOW** (مستوى CVSS: 3.7)
- **النطاق المتأثر (Affected Area):** إعدادات CORS في `server/index.js`

#### Problem (وصف المشكلة)
الخادم يطبق سياسة CORS مفتوحة بالكامل: `app.use(cors())` مما يسمح بتبادل الموارد مع أي نطاق خارجي دون تدقيق مصدر الطلب.

#### Current Status (الحالة الحالية)
تم توثيق المشكلة كـ Known Configuration Limitation. ونظراً لأن المصادقة أصبحت تعتمد على كوكيز `SameSite=Lax` مع تفعيل حماية `verifyCsrf` على طلبات التعديل، فإن مخاطر التزوير مقيدة؛ ولكن يجب قصر CORS على نطاق العميل المعتمد في بيئة الإنتاج.

---

## 3.4 Next Chapter (الفصل التالي)

انتقل لمراجعة خطوات تصليب استقرار النظام وإصلاح العيوب الهندسية:  
👉 **[4 - System Hardening](04-system-hardening.md)**
