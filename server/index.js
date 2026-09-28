import './env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authDbPromise, dataDbPromise } from './db.js';
import { OAuth2Client } from 'google-auth-library';
import { aiService } from './aiService.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { verifyToken, requireAdmin, requireAgent, verifyCsrf } from './middleware/auth.js';

// JWT helper — signs a token with minimum identity payload
function signAuthToken(userId, userRole) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    return jwt.sign(
        { id: userId, role: userRole },
        secret,
        { algorithm: 'HS256', expiresIn: '8h' }
    );
}

// Cookie helper — sets the JWT in a secure HttpOnly cookie
function setAuthCookie(res, token) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('authToken', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'strict' : 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        path: '/'
    });
}

// CSRF cookie helper — non-HttpOnly so JS can read it
function setCsrfCookie(res) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('csrfToken', csrfToken, {
        httpOnly: false, // must be readable by JS
        secure: isProd,
        sameSite: isProd ? 'strict' : 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/'
    });
    return csrfToken;
}

const app = express();
const PORT = process.env.PORT || 5000;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authDb = await authDbPromise;
const dataDb = await dataDbPromise;

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet());
app.use(limiter);
// CORS: allow credentials from the frontend (Vite dev server + same-origin in prod)
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));
app.use(cookieParser());
app.use(express.json());
// Protect uploads: only authenticated users can access uploaded identity documents (SEC-04)
app.use('/uploads', verifyToken, express.static('uploads'));

// Routes
// Initialize Tables
const initDb = async () => {
    // Auth DB Tables - Users
    await authDb.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        phone TEXT,
        role TEXT DEFAULT 'user',
        account_type TEXT DEFAULT 'individual',
        google_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Destinations Table
    await dataDb.run(`CREATE TABLE IF NOT EXISTS destinations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        price TEXT,
        image TEXT,
        description TEXT,
        type TEXT
    )`);

    // Groups Table
    await dataDb.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        agent_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Messages Table
    await dataDb.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Bookings Table
    await dataDb.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT,
        customer_name TEXT,
        phone TEXT,
        people_count INTEGER,
        notes TEXT,
        days INTEGER,
        package_type TEXT,
        travel_method TEXT,
        payment_method TEXT,
        passport_image_path TEXT,
        age INTEGER,
        date_of_birth DATE,
        place_of_birth TEXT,
        service_subtype TEXT,
        destination TEXT,
        status TEXT DEFAULT 'pending',
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Notifications Table
    await dataDb.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_phone TEXT,
        message TEXT,
        type TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ensure Pilgrims table has new fields if not exists (simplistic check)
    // In a real app, use migrations. Here we just ensure table exists.

    // Pilgrims table initialization (preserves existing data across restarts)
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

    // Migration: Add status column if it doesn't exist (for existing tables)
    try {
        await dataDb.run("ALTER TABLE pilgrims ADD COLUMN status TEXT DEFAULT 'active'");
    } catch (e) {
        // Column likely exists
    }

    // Migration: Add group_id column if it doesn't exist
    try {
        await dataDb.run("ALTER TABLE pilgrims ADD COLUMN group_id INTEGER");
    } catch (e) {
        // Column likely exists
    }

    // Migration: Add user_id column to bookings if it doesn't exist (SEC-03)
    try {
        await dataDb.run("ALTER TABLE bookings ADD COLUMN user_id INTEGER");
    } catch (e) {
        // Column likely exists
    }

    // Backfill user_id for legacy bookings where phone matches a user
    try {
        const users = await authDb.all("SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != ''");
        for (const u of users) {
            await dataDb.run("UPDATE bookings SET user_id = ? WHERE phone = ? AND user_id IS NULL", [u.id, u.phone]);
        }
    } catch (e) {
        // Safe fallback
    }

    // Alerts Table
    await dataDb.run(`CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pilgrim_id INTEGER,
        alert_type TEXT,
        message TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pilgrim_id) REFERENCES pilgrims(id)
    )`);

    // Seed Destinations if empty
    const destCount = await dataDb.get("SELECT COUNT(*) as count FROM destinations");
    if (destCount.count === 0) {
        await dataDb.run(`INSERT INTO destinations (title, price, image, description, type) VALUES 
        ('إسطنبول - تركيا', '$450', '/assets/images/offer_istanbul.jpg', 'رحلة إسطنبول تركيا. وجهة سياحية رائعة.', 'offer'),
        ('القاهرة - مصر', '$300', '/assets/images/offer_cairo.jpg', 'رحلة القاهرة مصر. رحلة ثقافية مميزة.', 'offer'),
        ('كوالالمبور - ماليزيا', '$650', '/assets/images/offer_malaysia.jpg', 'رحلة كوالالمبور ماليزيا. وجهة استوائية.', 'offer')`);
    }
};
initDb().catch(console.error);

app.get('/api/test', async (req, res) => {
    try {
        const row = await authDb.get('SELECT datetime("now") as now');
        res.json({ message: 'Server is running!', time: row.now });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// CSRF Token endpoint — client calls this on load to get a fresh CSRF token
app.get('/api/auth/csrf', (req, res) => {
    const csrfToken = setCsrfCookie(res);
    res.json({ csrfToken });
});

// Auth status — returns the verified server-side identity or 401
app.get('/api/auth/me', verifyToken, async (req, res) => {
    try {
        const user = await authDb.get(
            'SELECT id, name, email, phone, role, account_type FROM users WHERE id = ?',
            [req.user.id]
        );
        if (!user) return res.status(401).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout — clears auth and CSRF cookies
app.post('/api/logout', (req, res) => {
    res.clearCookie('authToken', { httpOnly: true, path: '/' });
    res.clearCookie('csrfToken', { httpOnly: false, path: '/' });
    res.json({ success: true });
});


// Destinations API
app.get('/api/destinations', async (req, res) => {
    try {
        const rows = await dataDb.all("SELECT * FROM destinations");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Agents API — requires authenticated user (agents/admins needed for pilgrim management)
app.get('/api/agents', verifyToken, async (req, res) => {
    try {
        const rows = await authDb.all("SELECT id, name, role FROM users WHERE role IN ('agent', 'admin')");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Groups API — requires authenticated user
app.get('/api/groups', verifyToken, async (req, res) => {
    try {
        const { agent_id } = req.query;
        let query = "SELECT * FROM groups";
        let params = [];
        if (agent_id) {
            query += " WHERE agent_id = ?";
            params.push(agent_id);
        }
        const rows = await dataDb.all(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/groups', verifyToken, requireAgent, verifyCsrf, async (req, res) => {
    try {
        const { name, agent_id } = req.body;
        const result = await dataDb.run("INSERT INTO groups (name, agent_id) VALUES (?, ?)", [name, agent_id]);
        res.json({ success: true, id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, phone, account_type } = req.body;

        // Check if user exists
        const existingUser = await authDb.get("SELECT * FROM users WHERE email = ? OR phone = ?", [email, phone]);
        if (existingUser) {
            return res.status(400).json({ error: "البريد الإلكتروني أو رقم الهاتف مسجل مسبقاً" });
        }

        // Hash password with bcrypt (cost factor 10)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await authDb.run(
            "INSERT INTO users (name, email, password, phone, account_type) VALUES (?, ?, ?, ?, ?)",
            [name, email, hashedPassword, phone, account_type || 'individual']
        );

        const newUser = {
            id: result.lastID,
            name,
            email,
            phone,
            role: 'user',
            account_type: account_type || 'individual'
        };

        res.json({ success: true, user: newUser });
    } catch (err) {
        console.error("Registration Error:", err.message);
        res.status(500).json({ error: "حدث خطأ أثناء إنشاء الحساب" });
    }
});

app.post('/api/google-login', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const { name, email, sub: googleId } = ticket.getPayload();

        let userId, userRole, userName, userEmail, userPhone;

        const users = await authDb.all("SELECT * FROM users WHERE email = ?", [email]);

        if (users.length > 0) {
            const user = users[0];
            if (!user.google_id) {
                await authDb.run("UPDATE users SET google_id = ? WHERE id = ?", [googleId, user.id]);
            }
            userId = user.id;
            userRole = user.role;
            userName = user.name;
            userEmail = user.email;
            userPhone = user.phone;
        } else {
            const lockedSecret = crypto.randomBytes(32).toString('hex');
            const lockedPassword = await bcrypt.hash(`OAUTH_LOCKED_${lockedSecret}`, 10);
            const result = await authDb.run(
                "INSERT INTO users (name, email, password, google_id) VALUES (?, ?, ?, ?)",
                [name, email, lockedPassword, googleId]
            );
            userId = result.lastID;
            userRole = 'user';
            userName = name;
            userEmail = email;
            userPhone = null;
        }

        // Issue JWT in secure HttpOnly cookie (SEC-02)
        const jwtToken = signAuthToken(userId, userRole);
        setAuthCookie(res, jwtToken);
        setCsrfCookie(res);

        return res.json({
            success: true,
            user: { id: userId, name: userName, email: userEmail, phone: userPhone, role: userRole }
        });
    } catch (err) {
        console.error("Google Login Error:", err.message);
        res.status(500).json({ error: "Google authentication failed" });
    }
});

import multer from 'multer';
import path from 'path';
import fs from 'fs';

// SEC-04: File upload security controls
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// File signature (magic bytes) validation function
function validateFileSignature(filePath) {
    const buffer = Buffer.alloc(16);
    let bytesRead = 0;
    try {
        const fd = fs.openSync(filePath, 'r');
        bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);
    } catch (e) {
        return { valid: false, error: 'Cannot read file' };
    }

    if (bytesRead < 4) return { valid: false, error: 'File too small' };

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { valid: true, type: 'image/jpeg' };
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return { valid: true, type: 'image/png' };
    }
    // PDF: %PDF- (25 50 44 46 2D)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return { valid: true, type: 'application/pdf' };
    }
    // WebP: RIFF at 0..3 and WEBP at 8..11
    if (
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
        return { valid: true, type: 'image/webp' };
    }

    return { valid: false, error: 'Invalid file signature' };
}

// Configure Multer with safe randomized filenames and strict extension/MIME filters
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const rawExt = path.extname(file.originalname || '').toLowerCase();
        const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.bin';
        const safeName = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`;
        cb(null, safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return cb(new Error('Invalid file extension. Only JPG, PNG, WebP, and PDF files are allowed.'));
        }
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return cb(new Error('Invalid MIME type. Only JPEG, PNG, WebP, and PDF documents are allowed.'));
        }
        cb(null, true);
    }
});

// Middleware wrapper to return clean 400 JSON errors for multer rejections
const handlePassportUpload = (req, res, next) => {
    upload.single('passport')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds the 5MB limit' });
            }
            return res.status(400).json({ error: err.message || 'File upload rejected' });
        }
        next();
    });
};

// Captcha Store (In-Memory)
const captchaStore = new Map();

// Helper to clean up old captchas
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of captchaStore.entries()) {
        if (now - data.timestamp > 5 * 60 * 1000) { // 5 minutes expiration
            captchaStore.delete(id);
        }
    }
}, 60 * 1000);

app.get('/api/captcha', (req, res) => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let answer;
    let question;

    // Simplification for better UX: keep it simple addition/subtraction usually, or small multiplication
    switch (operator) {
        case '+': answer = num1 + num2; question = `${num1} + ${num2}`; break;
        case '-': answer = num1 - num2; question = `${num1} - ${num2}`; break;
        case '*': answer = num1 * num2; question = `${num1} × ${num2}`; break;
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    captchaStore.set(id, { answer, timestamp: Date.now() });

    res.json({ id, question });
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password, captchaId, captchaAnswer } = req.body;

        // 1. Verify Captcha
        if (!captchaId || captchaAnswer === undefined) {
            return res.status(400).json({ error: "الرجاء حل المسألة الرياضية" });
        }

        const storedCaptcha = captchaStore.get(captchaId);
        if (!storedCaptcha) {
            return res.status(400).json({ error: "انتهت صلاحية التحقق، يرجى التحديث" });
        }

        if (parseInt(captchaAnswer) !== storedCaptcha.answer) {
            captchaStore.delete(captchaId);
            return res.status(400).json({ error: "إجابة خاطئة، يرجى المحاولة مرة أخرى" });
        }
        captchaStore.delete(captchaId);

        const user = await authDb.get("SELECT * FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
        }

        // Login notification for non-admins
        if (user.role !== 'admin') {
            const loginMessage = `تسجيل دخول: ${user.name} (${user.email}) - ${new Date().toLocaleString('ar-SA')}`;
            await dataDb.run(
                `INSERT INTO notifications (user_phone, message, type) VALUES (?, ?, ?)`,
                ['admin', loginMessage, 'login_alert']
            );
        }

        // Issue JWT in secure HttpOnly cookie (SEC-02)
        const token = signAuthToken(user.id, user.role);
        setAuthCookie(res, token);
        // Rotate CSRF token on login
        setCsrfCookie(res);

        // Return safe user data for UI (not the JWT)
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                account_type: user.account_type
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/bookings', verifyToken, verifyCsrf, handlePassportUpload, async (req, res) => {
    try {
        // Validate magic bytes if a file was uploaded (SEC-04)
        if (req.file) {
            const sig = validateFileSignature(req.file.path);
            if (!sig.valid) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
                return res.status(400).json({ error: 'Invalid file content: file signature does not match allowed types (spoofed file rejected)' });
            }
        }

        const authUser = await authDb.get("SELECT id, name, phone, role FROM users WHERE id = ?", [req.user.id]);
        if (!authUser) {
            if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
            return res.status(401).json({ error: "User not found" });
        }

        const { service_name, customer_name, phone, people_count, notes, days, package_type, travel_method, payment_method,
            age, date_of_birth, place_of_birth, service_subtype, destination } = req.body;
        const passport_image_path = req.file ? req.file.path : null;

        // Contact phone: caller may provide travel contact phone, or default to authUser.phone
        const contactPhone = phone || authUser.phone || '';

        // Bind booking immutably to authenticated user: user_id = authUser.id (SEC-03)
        const result = await dataDb.run(
            `INSERT INTO bookings (
                service_name, customer_name, phone, people_count, notes,
                days, package_type, travel_method, payment_method, passport_image_path,
                age, date_of_birth, place_of_birth, service_subtype, destination,
                user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                service_name, customer_name, contactPhone, people_count, notes,
                days, package_type, travel_method, payment_method, passport_image_path,
                age, date_of_birth, place_of_birth, service_subtype, destination,
                authUser.id
            ]
        );

        // Auto-add to pilgrims tracking if booking is for Hajj or Umrah
        if (service_name && (service_name.includes('حج') || service_name.includes('عمرة'))) {
            try {
                // Bind sponsor and agent directly to authenticated user, preventing impersonation (SEC-03)
                const arrivalDate = new Date();
                arrivalDate.setDate(arrivalDate.getDate() + 7);
                const formattedDate = arrivalDate.toISOString().split('T')[0];

                await dataDb.run(
                    `INSERT INTO pilgrims (name, passport_number, arrival_date, agent_id, sponsor_name, sponsor_phone, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
                    [
                        customer_name,
                        '',
                        formattedDate,
                        authUser.id, // User is the agent/sponsor
                        authUser.name, // Sponsor name = authenticated user name
                        authUser.phone || contactPhone // Sponsor phone = authenticated user phone
                    ]
                );
                console.log(`✅ Auto-added ${customer_name} to pilgrims tracking for ${service_name}`);
            } catch (pilgrimErr) {
                // Don't fail the booking if pilgrim addition fails
                console.error('Error auto-adding to pilgrims:', pilgrimErr);
            }
        }

        res.json({ success: true, message: "Booking created successfully", bookingId: result.lastID });
    } catch (err) {
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        console.error("Booking Error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
});

app.put('/api/admin/bookings/:id', verifyToken, requireAdmin, verifyCsrf, async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await dataDb.get("SELECT * FROM bookings WHERE id = ?", [req.params.id]);

        await dataDb.run("UPDATE bookings SET status = ? WHERE id = ?", [status, req.params.id]);

        if (booking && booking.phone) {
            let message = `تم تحديث حالة طلبك (${booking.service_name}) إلى: ${status === 'confirmed' ? 'مؤكد' : status === 'cancelled' ? 'ملغي' : status}`;
            await dataDb.run(
                "INSERT INTO notifications (user_phone, message, type) VALUES (?, ?, ?)",
                [booking.phone, message, 'status_update']
            );
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Notifications — object-level ownership scoped to req.user (SEC-03)
app.get('/api/notifications', verifyToken, async (req, res) => {
    try {
        const authUser = await authDb.get("SELECT id, phone, role FROM users WHERE id = ?", [req.user.id]);
        if (!authUser) return res.status(401).json({ error: "User not found" });

        const phone = req.query.phone;

        // Admin retains visibility: can view alerts targeted to 'admin' or filter by specific phone
        if (req.user.role === 'admin') {
            const targetPhone = phone || 'admin';
            const rows = await dataDb.all("SELECT * FROM notifications WHERE user_phone = ? ORDER BY created_at DESC", [targetPhone]);
            return res.json(rows);
        }

        // Non-admin user: cannot request another user's notifications or admin alerts
        if (phone && authUser.phone && phone !== authUser.phone) {
            return res.status(403).json({ error: "Access denied: cannot access another user's notifications" });
        }

        // Bind strictly to authenticated user's phone
        if (!authUser.phone) return res.json([]);
        const rows = await dataDb.all("SELECT * FROM notifications WHERE user_phone = ? ORDER BY created_at DESC", [authUser.phone]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/notifications/read', verifyToken, verifyCsrf, async (req, res) => {
    try {
        const authUser = await authDb.get("SELECT id, phone, role FROM users WHERE id = ?", [req.user.id]);
        if (!authUser) return res.status(401).json({ error: "User not found" });

        // Non-admin can only mark their own notifications as read
        const targetPhone = req.user.role === 'admin' ? (req.body.phone || 'admin') : authUser.phone;
        if (targetPhone) {
            await dataDb.run("UPDATE notifications SET is_read = 1 WHERE user_phone = ?", [targetPhone]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.delete('/api/admin/messages/:id', verifyToken, requireAdmin, verifyCsrf, async (req, res) => {
    try {
        await dataDb.run("DELETE FROM messages WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/admin/send-notification', verifyToken, requireAdmin, verifyCsrf, async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) return res.status(400).json({ error: "Missing fields" });

        await dataDb.run(
            "INSERT INTO notifications (user_phone, message, type) VALUES (?, ?, ?)",
            [phone, message, 'admin_alert']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/api/contact', async (req, res) => {
    try {
        const { name, phone, message } = req.body;
        await dataDb.run("INSERT INTO messages (name, phone, message) VALUES (?, ?, ?)", [name, phone, message]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Admin Routes — all require verified JWT + admin role
app.get('/api/admin/stats', verifyToken, requireAdmin, async (req, res) => {
    try {
        const users = await authDb.get("SELECT COUNT(*) as count FROM users");
        const messages = await dataDb.get("SELECT COUNT(*) as count FROM messages");
        const bookings = await dataDb.get("SELECT COUNT(*) as count FROM bookings");

        res.json({
            users: users.count,
            messages: messages.count,
            bookings: bookings.count
        });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/admin/users', verifyToken, requireAdmin, async (req, res) => {
    try {
        const rows = await authDb.all("SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.put('/api/admin/users/:id/role', verifyToken, requireAdmin, verifyCsrf, async (req, res) => {
    try {
        const { role } = req.body;
        await authDb.run(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.get('/api/admin/messages', verifyToken, requireAdmin, async (req, res) => {
    try {
        const rows = await dataDb.all("SELECT * FROM messages ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/admin/bookings', verifyToken, requireAdmin, async (req, res) => {
    try {
        const rows = await dataDb.all("SELECT * FROM bookings ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// User bookings — bound to authenticated user identity (SEC-03)
app.get('/api/my-bookings', verifyToken, async (req, res) => {
    try {
        const authUser = await authDb.get("SELECT id, phone, role FROM users WHERE id = ?", [req.user.id]);
        if (!authUser) return res.status(401).json({ error: "User not found" });

        const { phone } = req.query;

        // Admin retains broad visibility: if phone is provided in query, filter by it; otherwise return all
        if (req.user.role === 'admin') {
            if (phone) {
                const rows = await dataDb.all("SELECT * FROM bookings WHERE phone = ? ORDER BY created_at DESC", [phone]);
                return res.json(rows);
            }
            const rows = await dataDb.all("SELECT * FROM bookings ORDER BY created_at DESC");
            return res.json(rows);
        }

        // Non-admin users: must only access their own bookings.
        // If an untrusted phone query is supplied that does not belong to the user, reject access.
        if (phone && authUser.phone && phone !== authUser.phone) {
            return res.status(403).json({ error: "Access denied: cannot access another user's bookings" });
        }

        // Bind strictly to authenticated user identity: match by user_id or user's phone for legacy records
        const rows = await dataDb.all(
            "SELECT * FROM bookings WHERE user_id = ? OR (user_id IS NULL AND phone = ?) ORDER BY created_at DESC",
            [authUser.id, authUser.phone || '']
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching user bookings:", err);
        res.status(500).json({ error: "Server error" });
    }
});


// Pilgrims Tracking Routes
app.post('/api/pilgrims', verifyToken, requireAgent, verifyCsrf, async (req, res) => {
    try {
        const { name, passport_number, arrival_date, agent_id, sponsor_name, sponsor_phone, group_id } = req.body;

        // Non-admin agents can only create pilgrims assigned to themselves (SEC-03)
        const assignedAgentId = req.user.role === 'admin' ? (agent_id || req.user.id) : req.user.id;

        await dataDb.run(
            `INSERT INTO pilgrims (name, passport_number, arrival_date, agent_id, sponsor_name, sponsor_phone, group_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
            [name, passport_number, arrival_date, assignedAgentId, sponsor_name, sponsor_phone, group_id]
        );

        res.json({ success: true, message: 'تم إضافة المعتمر بنجاح' });
    } catch (err) {
        console.error('Error adding pilgrim:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المعتمر' });
    }
});

app.post('/api/pilgrims/bulk', verifyToken, requireAgent, verifyCsrf, async (req, res) => {
    try {
        const { pilgrims, agent_id } = req.body;

        if (!Array.isArray(pilgrims) || pilgrims.length === 0) {
            return res.status(400).json({ error: 'No pilgrims data provided' });
        }

        // Non-admin agents can only create pilgrims assigned to themselves (SEC-03)
        const assignedAgentId = req.user.role === 'admin' ? (agent_id || req.user.id) : req.user.id;

        const stmt = await dataDb.prepare(`
            INSERT INTO pilgrims (name, passport_number, arrival_date, sponsor_name, sponsor_phone, agent_id, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        `);

        await dataDb.run('BEGIN TRANSACTION');

        for (const p of pilgrims) {
            await stmt.run([
                p.name,
                p.passport_number,
                p.arrival_date,
                p.sponsor_name || '',
                p.sponsor_phone || '',
                assignedAgentId
            ]);
        }

        await stmt.finalize();
        await dataDb.run('COMMIT');

        res.json({ success: true, count: pilgrims.length, message: `تم إضافة ${pilgrims.length} معتمر بنجاح` });
    } catch (err) {
        await dataDb.run('ROLLBACK');
        console.error('Error adding bulk pilgrims:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المعتمرين' });
    }

});

app.get('/api/pilgrims', verifyToken, async (req, res) => {
    try {
        const { agent_id } = req.query;

        // 1. Fetch Pilgrims from Data DB
        let query = `
            SELECT p.*,
                   CAST((julianday('now') - julianday(p.arrival_date)) AS INTEGER) as days_passed,
                   CAST((90 - (julianday('now') - julianday(p.arrival_date))) AS INTEGER) as days_remaining
            FROM pilgrims p
            WHERE p.status = 'active'
        `;

        const params = [];

        if (req.user.role === 'admin') {
            // Admin retains broader visibility: optional filter by agent_id
            if (agent_id) {
                query += ' AND p.agent_id = ?';
                params.push(agent_id);
            }
        } else {
            // Agents / non-admin: strictly scoped to authenticated user ID (SEC-03)
            if (agent_id && parseInt(agent_id) !== req.user.id) {
                return res.status(403).json({ error: "Access denied: cannot view pilgrims assigned to another agent" });
            }
            query += ' AND p.agent_id = ?';
            params.push(req.user.id);
        }

        query += ' ORDER BY days_remaining ASC';

        const pilgrims = await dataDb.all(query, params);

        // 2. Fetch Agent Names from Auth DB (since they are in separate DBs)
        if (pilgrims.length > 0) {
            const agentIds = [...new Set(pilgrims.map(p => p.agent_id).filter(id => id))];
            if (agentIds.length > 0) {
                // Construct simpler query carefully
                const placeholders = agentIds.map(() => '?').join(',');
                const users = await authDb.all(`SELECT id, name FROM users WHERE id IN (${placeholders})`, agentIds);

                // Map users to a lookup object
                const userMap = {};
                users.forEach(u => userMap[u.id] = u.name);

                // Attach agent_name to pilgrims
                pilgrims.forEach(p => {
                    p.agent_name = userMap[p.agent_id] || 'N/A';
                });
            }
        }

        res.json(pilgrims);
    } catch (err) {
        console.error('Error fetching pilgrims:', err);
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.get('/api/pilgrims/check-alerts', verifyToken, requireAgent, async (req, res) => {
    try {
        // Get pilgrims with 70+ days
        const criticalPilgrims = await dataDb.all(`
            SELECT p.*, 
                   CAST((julianday('now') - julianday(p.arrival_date)) AS INTEGER) as days_passed,
                   CAST((90 - (julianday('now') - julianday(p.arrival_date))) AS INTEGER) as days_remaining
            FROM pilgrims p
            WHERE p.status = 'active'
              AND (julianday('now') - julianday(p.arrival_date)) >= 70
        `);

        const alerts = [];
        for (const pilgrim of criticalPilgrims) {
            // Check if alert already sent today
            const today = new Date().toISOString().split('T')[0];
            const existingAlert = await dataDb.get(
                `SELECT * FROM alerts 
                 WHERE pilgrim_id = ? 
                   AND DATE(sent_at) = DATE('now')`,
                [pilgrim.id]
            );

            if (!existingAlert) {
                const message = `⚠️ تحذير: المعتمر ${pilgrim.name} (جواز: ${pilgrim.passport_number}) له ${pilgrim.days_passed} يوم. متبقي ${pilgrim.days_remaining} يوم فقط!`;

                // Save alert
                await dataDb.run(
                    `INSERT INTO alerts (pilgrim_id, alert_type, message) VALUES (?, ?, ?)`,
                    [pilgrim.id, 'warning', message]
                );

                // Log sponsor notification (placeholder for actual SMS/WhatsApp)
                if (pilgrim.sponsor_phone) {
                    console.log(`📱 إرسال تحذير للضامن ${pilgrim.sponsor_name} (${pilgrim.sponsor_phone}): ${message}`);
                }

                alerts.push({ pilgrim, message, sponsor: pilgrim.sponsor_name });
            }
        }

        res.json({
            success: true,
            alerts_count: alerts.length,
            alerts: alerts
        });
    } catch (err) {
        console.error('Error checking alerts:', err);
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

app.put('/api/pilgrims/:id/status', verifyToken, requireAgent, verifyCsrf, async (req, res) => {
    try {
        const { status } = req.body;
        await dataDb.run(
            'UPDATE pilgrims SET status = ? WHERE id = ?',
            [status, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// PDF Export for user's pilgrims
app.get('/api/pilgrims/export-pdf', verifyToken, async (req, res) => {
    try {
        const { agent_id } = req.query;

        let query = `
            SELECT p.*, 
                   CAST((julianday('now') - julianday(p.arrival_date)) AS INTEGER) as days_passed,
                   CAST((90 - (julianday('now') - julianday(p.arrival_date))) AS INTEGER) as days_remaining
            FROM pilgrims p
            WHERE p.status = 'active'
        `;

        const params = [];

        if (req.user.role === 'admin') {
            if (agent_id) {
                query += ' AND p.agent_id = ?';
                params.push(agent_id);
            }
        } else {
            // Agents / non-admin: strictly scoped to authenticated user ID (SEC-03)
            if (agent_id && parseInt(agent_id) !== req.user.id) {
                return res.status(403).json({ error: "Access denied: cannot export pilgrims assigned to another agent" });
            }
            query += ' AND p.agent_id = ?';
            params.push(req.user.id);
        }

        const pilgrims = await dataDb.all(query, params);

        // Simple HTML to PDF conversion
        let html = `
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial; direction: rtl; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background: #1f3c58; color: white; }
                .red { background: #ffebee; color: #c62828; font-weight: bold; }
                .orange { background: #fff3e0; color: #ef6c00; }
                .yellow { background: #fffde7; color: #f57f17; }
                .green { background: #e8f5e9; color: #2e7d32; }
            </style>
        </head>
        <body>
            <h1>تقرير متابعة المعتمرين</h1>
            <p>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</p>
            <table>
                <tr>
                    <th>الاسم</th>
                    <th>رقم الجواز</th>
                    <th>تاريخ الوصول</th>
                    <th>الأيام المنقضية</th>
                    <th>الأيام المتبقية</th>
                    <th>الحالة</th>
                </tr>
        `;

        pilgrims.forEach(p => {
            const rowClass = p.days_remaining <= 20 ? 'red' : p.days_remaining <= 30 ? 'orange' : p.days_remaining <= 60 ? 'yellow' : 'green';
            const status = p.days_remaining <= 20 ? '🔴 حرج جداً' : p.days_remaining <= 30 ? '🟠 حرج' : p.days_remaining <= 60 ? '🟡 تحذير' : '🟢 آمن';

            html += `
                <tr class="${rowClass}">
                    <td>${p.name}</td>
                    <td>${p.passport_number}</td>
                    <td>${new Date(p.arrival_date).toLocaleDateString('ar-SA')}</td>
                    <td>${p.days_passed} يوم</td>
                    <td>${p.days_remaining} يوم</td>
                    <td>${status}</td>
                </tr>
            `;
        });

        html += `
            </table>
            <br><br>
            <p style="text-align: center; color: #666;">الكويت للسفريات والسياحة - هاتف: 776358963</p>
        </body>
        </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="pilgrims-report-${Date.now()}.html"`);
        res.send(html);

    } catch (err) {
        console.error('Error generating PDF:', err);
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// AI Routes
app.get('/api/ai/status', (req, res) => {
    res.json(aiService.getAvailableProviders());
});

import { loadKnowledgeBase } from './knowledge_loader.js';

// Load Knowledge Base
const knowledgeBase = loadKnowledgeBase();



// AI generate — requires authentication to prevent cost/abuse
app.post('/api/ai/generate', verifyToken, async (req, res) => {
    try {
        const { text, provider, task, context, apiKey } = req.body;
        if (!text) return res.status(400).json({ error: 'Text required' });

        let systemPrompt = "You are a helpful assistant.";
        if (task === 'sentiment') {
            systemPrompt = `Analyze the sentiment of the text. Return a JSON object with keys: "sentiment" (Positive/Negative/Neutral), "score" (0-1), "summary" (very brief). Return ONLY JSON.`;
        }

        const response = await aiService.generate(text, provider, systemPrompt, context, apiKey, knowledgeBase);

        if (task === 'sentiment') {
            try {
                const firstBrace = response.indexOf('{');
                const lastBrace = response.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    const jsonStr = response.substring(firstBrace, lastBrace + 1);
                    res.json(JSON.parse(jsonStr));
                    return;
                }
            } catch (e) { console.warn("Failed to parse JSON from AI, returning raw."); }
        }

        res.json({ response });

    } catch (err) {
        console.error("AI Endpoint Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Ollama & Gemini Chat Endpoint
import { ollamaService } from './ollamaService.js';
import { geminiService } from './geminiService.js';

app.post('/api/ai/chat', verifyToken, async (req, res) => {
    try {
        const { message, context, provider = 'ollama' } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log(`🤖 AI Request using provider: ${provider}`);

        let stream;
        if (provider === 'gemini') {
            stream = await geminiService.generateResponseStream(message, context);
        } else {
            stream = await ollamaService.generateResponseStream(message, context);
        }

        // Set headers for SSE-like streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Pipe the fetch stream to the response
        const decoder = new TextDecoder();
        for await (const chunk of stream) {
            const text = decoder.decode(chunk);

            if (provider === 'gemini') {
                // Parse Gemini Stream Format
                // Gemini returns JSON array format like: [{ "candidates": [...] }]
                // We need to extract the text part cleanly
                try {
                    // Gemini sends "data: " prefix sometimes or raw JSON
                    const cleanText = text.replace(/^data: /, '').trim();
                    if (cleanText === '[DONE]') continue;

                    // Handle multiple JSON objects in one chunk
                    // Remove starting '[' and ending ']' or ',' to parse correctly line by line is hard
                    // Simple Regex extraction for "text" field might be safer for raw stream

                    const match = text.match(/"text":\s*"([^"]*)"/g);
                    if (match) {
                        for (const m of match) {
                            // Extract content inside quotes and unescape
                            let content = m.replace(/"text":\s*"/, '').replace(/"$/, '');
                            // Fix common JSON escapes
                            content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                            res.write(content);
                        }
                    } else {
                        // Fallback: try parsing JSON directly if it's a clean object
                        try {
                            const json = JSON.parse(cleanText);
                            if (json.candidates && json.candidates[0].content) {
                                res.write(json.candidates[0].content.parts[0].text);
                            }
                        } catch (e) { }
                    }
                } catch (e) { console.error('Gemini parse error', e); }

            } else {
                // Ollama Logic (Existing)
                try {
                    const lines = text.split('\n').filter(line => line.trim() !== '');
                    for (const line of lines) {
                        try {
                            const json = JSON.parse(line);
                            if (json.message && json.message.content) {
                                res.write(json.message.content);
                            }
                        } catch (err) { }
                    }
                } catch (e) { }
            }
        }
        res.end();

    } catch (error) {
        console.error('AI Chat Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.end();
        }
    }
});


// TTS — requires authentication to prevent cost/abuse
import { ttsService } from './ttsService.js';

app.post('/api/tts', verifyToken, async (req, res) => {
    try {
        const { text, provider } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const ttsApiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY;
        const result = await ttsService.generate(text, 'google', { google: ttsApiKey });
        res.json(result);
    } catch (error) {
        console.error('TTS Endpoint Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
