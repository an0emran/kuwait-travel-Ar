
import bcrypt from 'bcryptjs';
import { authDbPromise } from './db.js';

(async () => {
    try {
        const db = await authDbPromise;

        const rawPassword = process.env.ADMIN2_DEFAULT_PASSWORD || 'admin2026';
        const hashedPassword = bcrypt.hashSync(rawPassword, 10);

        const newAdmin = {
            name: 'New Admin',
            email: 'admin2@kuwait-travel.com',
            password: hashedPassword,
            phone: '96500000002',
            role: 'admin',
            account_type: 'individual'
        };

        // Check if user exists
        const existing = await db.get("SELECT * FROM users WHERE email = ?", [newAdmin.email]);

        if (existing) {
            await db.run("UPDATE users SET password = ?, role = 'admin' WHERE email = ?", [newAdmin.password, newAdmin.email]);
            console.log('✅ Updated existing user to Admin with hashed password.');
        } else {
            await db.run(
                "INSERT INTO users (name, email, password, phone, role, account_type) VALUES (?, ?, ?, ?, ?, ?)",
                [newAdmin.name, newAdmin.email, newAdmin.password, newAdmin.phone, newAdmin.role, newAdmin.account_type]
            );
            console.log('✅ Created new Admin user with hashed password.');
        }

        console.log('================================');
        console.log('🆕 بيانات الأدمن:');
        console.log(`📧 البريد: ${newAdmin.email}`);
        console.log(`🔑 كلمة المرور: [CONFIGURED_AND_HASHED]`);
        console.log('================================');
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
})();
