# 4 - System Hardening

[← العودة إلى الفصل 3: Security Assessment](03-security-assessment.md) | [الفصل التالي: Authentication & Authorization →](05-authentication-and-authorization.md)

---

## 4.1 Overview (نظرة عامة على التصليب الهندسي)

قبل الانتقال إلى معالجة ثغرات التحكم بالوصول والمصادقة المتقدمة، كان من الضروري ترقية وتثبيت البنية الهندسية الأساسية للتطبيق. أظهر التدقيق الأولي وجود خمسة عيوب هندسية وإعدادية (BUG-001 إلى BUG-005) تسببت في فقدان البيانات التشغيلية عند إعادة تشغيل الخادم، حدوث أخطاء برمجية أوقفت فحص التنبيهات، تشتت ملفات قواعد البيانات عبر المسارات النسبية، فشل تهيئة خدمات الذكاء الاصطناعي، وتضمين مفاتيح برمجية حساسة داخل الكود.

تمت معالجة كل عيب وفق المنهجية الهندسية الصارمة:

$$\text{Problem} \longrightarrow \text{Root Cause} \longrightarrow \text{Implementation} \longrightarrow \text{Verification} \longrightarrow \text{Result}$$

---

## 4.2 BUG-001: فقدان بيانات المعتمرين عند إعادة تشغيل الخادم

### Problem (المشكلة)
في كل مرة يتم فيها إعادة تشغيل خادم Node.js (سواء بسبب تعديل الكود في بيئة التطوير، أو إعادة تشغيل الخادم، أو حدوث Crash مفاجئ)، تختفي كافة سجلات المعتمرين التي قام الوكلاء بإدخالها أو استيرادها عبر ملفات Excel بشكل كامل، مما يضطر المستخدمين لإعادة إدخال البيانات من جديد.

### Root Cause (السبب الجذري)
أثناء مرحلة تهيئة قواعد البيانات عبر الدالة `initDb()` في الملف `server/index.js`، كان الكود ينفذ استعلام DDL تدميرياً بشكل غير مشروط:
```javascript
// كود مسبب للمشكلة في server/index.js
await dataDb.run(`DROP TABLE IF EXISTS pilgrims`);
await dataDb.run(`CREATE TABLE IF NOT EXISTS pilgrims (...)`);
```
تم وضع هذا السطر سابقاً كحل مؤقت لتجاوز تعارض Foreign Key، لكنه تسبب في حذف الجدول بجميع بياناته عند كل تشغيل للتطبيق.

### Implementation (خطوات الإصلاح)
تم إلغاء استعلام `DROP TABLE` التدميري نهائياً، واستبداله باستراتيجية ترحيل هيكلي تراكمية (Additive Migrations) تعتمد على `CREATE TABLE IF NOT EXISTS` مع استعلامات `ALTER TABLE` آمنة محاطة بكتل `try/catch` لإضافة الأعمدة الجديدة دون مساس بالبيانات القديمة:
```javascript
// الكود المصحح في server/index.js
await dataDb.run(`CREATE TABLE IF NOT EXISTS pilgrims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    passport_number TEXT,
    arrival_date DATE,
    agent_id INTEGER,
    sponsor_name TEXT,
    sponsor_phone TEXT,
    group_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// ترقية تراكمية آمنة دون حذف البيانات
try {
    await dataDb.run("ALTER TABLE pilgrims ADD COLUMN status TEXT DEFAULT 'active'");
} catch (e) { /* العمود موجود مسبقاً */ }

try {
    await dataDb.run("ALTER TABLE pilgrims ADD COLUMN group_id INTEGER");
} catch (e) { /* العمود موجود مسبقاً */ }
```

### Verification (إجراءات التحقق)
1. إدخال عدة سجلات اختبارية للمعتمرين مع تواريخ وصول وأرقام جوازات صالحة في `data.sqlite`.
2. الاستعلام عبر `GET /api/pilgrims` للتأكد من حفظ السجلات.
3. إنهاء عملية الخادم كلياً وإجراء إعادة تشغيل باردة (Cold Restart) عبر الأمر `node server/index.js`.
4. إعادة طلب نقطة النهاية `GET /api/pilgrims` وفحص عدد الصفوف في قاعدة البيانات مباشرة عبر SQLite CLI.

### Result (النتيجة)
**VERIFIED:** تم الحفاظ التام على سجلات المعتمرين بنسبة 100% عبر مرات إعادة التشغيل، وأصبحت ترقيات الجداول تتم بطريقة Additive غير تدميرية.

---

## 4.3 BUG-002: غياب مخطط جدول التنبيهات (Alerts Schema)

### Problem (المشكلة)
عند زيارة وكيل السفر للوحة متابعة المعتمرين أو عند تشغيل فحص مدد الإقامة آلياً عبر المسار `GET /api/pilgrims/check-alerts`، كان الخادم ينهار فورياً أو يُرجع خطأ `HTTP 500 Internal Server Error` مصحوباً بالرسالة:
```text
SQLITE_ERROR: no such table: alerts
```

### Root Cause (السبب الجذري)
يقوم معالج المسار `/api/pilgrims/check-alerts` بمحاولة إدراج التنبيهات الخاصة بالمعتمرين المتجاوزين لـ 70 يوماً داخل جدول يسمى `alerts`، ولكن هذا الجدول لم يكن قد تم تعريفه أو إنشاؤه إطلاقاً في دالة التهيئة `initDb()`.

### Implementation (خطوات الإصلاح)
تمت إضافة تعريف هيكلي صريح ومنظم لجدول `alerts` داخل دالة التهيئة `initDb()` في `server/index.js` مع ربطه كعلاقة Foreign Key بجدول المعتمرين:
```javascript
// الكود المصحح في server/index.js
await dataDb.run(`CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pilgrim_id INTEGER,
    alert_type TEXT,
    message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pilgrim_id) REFERENCES pilgrims(id)
)`);
```

### Verification (إجراءات التحقق)
1. إنشاء سجل معتمر بتاريخ وصول يعود إلى 75 يوماً مضت (ليتجاوز حد التحذير البالغ 70 يوماً).
2. استدعاء مسار فحص التنبيهات `GET /api/pilgrims/check-alerts`.
3. التحقق من استجابة الخادم بنجاح برمز `HTTP 200 OK` وإرجاع مصفوفة التنبيهات المتولدة.
4. التأكد من حفظ سجل التنبيه بنجاح داخل جدول `alerts` في قاعدة البيانات `data.sqlite`.

### Result (النتيجة)
**VERIFIED:** يتم إنشاء جدول `alerts` تلقائياً واستقراره عند بدء تشغيل الخادم، وتعمل منظومة فحص مدد الإقامة وإطلاق التنبيهات الاستباقية دون أية أخطاء برمجية.

---

## 4.4 BUG-003: تشتت مسارات قواعد بيانات SQLite النسبية

### Problem (المشكلة)
عند تشغيل الخادم أو أدوات الصيانة (`create_admin.js`, `seedAgents.js`) من مسارات مختلفة (مثل تشغيل `node server/index.js` من المجلد الرئيسي مقابل تشغيل `node index.js` من داخل مجلد `server/`)، كان التطبيق ينشئ ملفات SQLite مكررة وجديدة، مما جعل التعديلات التي تتم في مجلد غير مرئية في المجلد الآخر.

### Root Cause (السبب الجذري)
في الملف `server/db.js`، تم تعريف مسارات الاتصال بقواعد البيانات باستخدام مسارات نسبية تبدأ بـ `./`:
```javascript
// الكود السابق المعيب في server/db.js
const authDbPromise = open({ filename: './auth.sqlite', driver: sqlite3.Database });
const dataDbPromise = open({ filename: './data.sqlite', driver: sqlite3.Database });
```
في بيئة Node.js، تُحل المسارات النسبية بناءً على مسار مجلد التشغيل الحالي للعملية (`process.cwd()`)، وليس مسار مكان الملف البرمجي نفسه.

### Implementation (خطوات الإصلاح)
إعادة صياغة `server/db.js` لتثبيت وحل المسارات المطلقة بشكل قاطع بالنسبة للمجلد الجذري للمشروع باستخدام أدوات مسارات Node.js المعيارية (`path.resolve` و `fileURLToPath`):
```javascript
// الكود المصحح في server/db.js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تثبيت المسارات المطلقة للمشروع بغض النظر عن process.cwd()
const AUTH_DB_PATH = path.resolve(__dirname, '../auth.sqlite');
const DATA_DB_PATH = path.resolve(__dirname, '../data.sqlite');

const authDbPromise = open({ filename: AUTH_DB_PATH, driver: sqlite3.Database });
const dataDbPromise = open({ filename: DATA_DB_PATH, driver: sqlite3.Database });

export { authDbPromise, dataDbPromise, AUTH_DB_PATH, DATA_DB_PATH };
```

### Verification (إجراءات التحقق)
1. كتابة سجل اختباري في قاعدة البيانات بواسطة سكريبت انطلق من المجلد الجذري للمشروع.
2. تشغيل سكريبت آخر من داخل المجلد الفرعي `server/` وقراءة نفس السجل.
3. التأكد من أن كلا السكريبتين يتعاملان حصرياً مع نفس الملفين المطلقين (`auth.sqlite` و `data.sqlite`) في جذر المشروع.

### Result (النتيجة)
**VERIFIED:** توحيد مسار قواعد البيانات كمرجع وحيد مطلق (Single Source of Truth) وضمان عدم تكرار إنشاء قواعد بيانات مبعثرة نهائياً.

---

## 4.5 BUG-004: تعطل تهيئة خدمات الذكاء الاصطناعي بسبب Hoisting

### Problem (المشكلة)
عند بدء تشغيل الخادم مع وجود مفاتيح صالحة لخدمات Google Gemini أو LangChain في ملف `.env`، كان طلب نقطة النهاية `GET /api/ai/status` يُرجع جميع المزودين بحالة معطلة:
```json
{ "gemini": false, "openai": false, "claude": false, "custom": false, "mock": true }
```

### Root Cause (السبب الجذري)
في بيئة وحدات ECMAScript Modules (ESM)، يتم عمل Hoisting وتدقيق واستدعاء لكافة استيرادات `import` الثابتة قبل تنفيذ أي كود إجرائي. وكان ترتيب الكود في `server/index.js` كالتالي:
```javascript
// الكود المسبب للمشكلة
import { aiService } from './aiService.js'; // 1. يُنفذ الـ Constructor فوراً
import dotenv from 'dotenv';
dotenv.config();                          // 2. يُنفذ بعد انتهاء بناء كائن aiService!
```
نظراً لأن كائن `aiService` كان يحاول قراءة `process.env.GOOGLE_API_KEY` داخل دالة البناء (Constructor) الخاصة به، كانت القيمة لا تزال `undefined`، مما أجبر الخدمة على التحول التلقائي إلى وضع Mock Mode.

### Implementation (خطوات الإصلاح)
تم إنشاء موديول مستقل ومخصص لتهيئة المتغيرات البيئية باسم `server/env.js` ينفذ `dotenv.config()` استباقياً باستخدام المسار المطلق لملف `.env`، وجعله أول استيراد في السطر الأول من `server/index.js`:
```javascript
// server/env.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحميل المتغيرات من المسار المطلق للجذر
dotenv.config({ path: path.resolve(__dirname, '../.env') });
```
```javascript
// السطر الأول في server/index.js
import './env.js'; // يضمن اكتمال حقن المتغيرات البيئية قبل أية استيرادات أخرى
import express from 'express';
import { aiService } from './aiService.js';
```

### Verification (إجراءات التحقق)
1. وضع مفتاح تجريبي في ملف `.env`.
2. تشغيل الخادم واستدعاء المسار `GET /api/ai/status`.
3. التحقق من أن الاستجابة أصبحت تعيد `gemini: true` وأن المحادثة والذكاء الاصطناعي يستجيبان عبر البث التدفقي (Streaming) دون الرجوع لوضع الـ Mock.

### Result (النتيجة)
**VERIFIED:** تحميل المتغيرات البيئية بشكل حتمي وموثوق على مستوى التطبيق بالكامل قبل تهيئة أي مزود خدمة.

---

## 4.6 BUG-005: تنظيف البيانات الحساسة ومفاتيح API

### Problem (المشكلة)
تضمين مفاتيح برمجية حساسة لخدمات Google Cloud و Gemini API كنصوص صريحة مباشرة داخل ملفات السيرفر (`server/geminiService.js` و `server/index.js`)، مما كان يهدد بتسريبها عند مشاركة الكود أو رفعه إلى أنظمة إدارة النسخ.

### Root Cause (السبب الجذري)
الاعتماد على نسخ المفاتيح ولصقها في الكود كحلول سريعة أثناء بناء النماذج التجريبية الأولى بدلاً من قراءتها من `process.env`.

### Implementation (خطوات الإصلاح)
1. **تطهير الشيفرة (Secret Eviction):** إزالة كافة النصوص الصريحة لمفاتيح API من ملفات الكود المصدري.
2. **الربط ببيئة التشغيل:** قراءة المفاتيح حصراً عبر `process.env.GOOGLE_API_KEY` و `process.env.GOOGLE_TTS_API_KEY`.
3. **توفير قالب بيئي:** إنشاء ملف نموذج موحد ومطهر `.env.example` في جذر المشروع يوضح أسماء المتغيرات المطلوبة دون قيم سرية.
4. **تدوير الاعتماد (Credential Rotation):** إلغاء المفاتيح التي تم تداولها وتوليد مفاتيح جديدة وحفظها محلياً في `.env` المستثنى في `.gitignore`.

### Verification (إجراءات التحقق)
تنفيذ فحص مؤتمت يعتمد على التعبيرات النمطية (Regex Scan) عبر كافة ملفات المشروع للبحث عن أية سلاسل تطابق صيغة مفاتيح Google API (`AIzaSy...`)، والتأكد من عدم وجود أية مفاتيح صلبة خارج ملف `.env` المحلي المحمي.

### Result (النتيجة)
**VERIFIED:** خلو الشيفرة المصدرية تماماً من أية مفاتيح أو أسرار برمجية، وفصل الأسرار عن المنطق البرمجي وفق أفضل الممارسات.

---

## 4.7 ملخص أعمال التصليب الهندسي

| المعرف | المكون | التعديل الهندسي المنجز | الأثر التشغيلي |
|---|---|---|---|
| **BUG-001** | `server/index.js` | إلغاء `DROP TABLE pilgrims` واستخدام Additive Migrations | بقاء سجلات المعتمرين ثابتة ومستقرة |
| **BUG-002** | `server/index.js` | إنشاء جدول `alerts` في دالة `initDb()` | عمل فحص مدد إقامة المعتمرين دون أخطاء |
| **BUG-003** | `server/db.js` | اعتماد المسارات المطلقة الآمنة لملفات SQLite | توحيد مرجع قواعد البيانات ومنع التكرار |
| **BUG-004** | `server/env.js` | إنشاء موديول التحميل الاستباقي لـ `.env` | استقرار عمل واجهات وخدمات الذكاء الاصطناعي |
| **BUG-005** | Source Code & `.env` | عزل الأسرار وتوفير قالب `.env.example` | تحقيق النظافة الأمنية لحفظ المفاتيح |

---

## 4.8 Next Chapter (الفصل التالي)

انتقل لدراسة آليات تشفير كلمات المرور وتطبيق أنظمة التفويض والمصادقة المتقدمة:  
👉 **[5 - Authentication & Authorization](05-authentication-and-authorization.md)**
