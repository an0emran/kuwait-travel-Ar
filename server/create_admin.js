import bcrypt from 'bcryptjs';
import { authDbPromise } from './db.js';

(async () => {
    try {
        const db = await authDbPromise;

        // Get current table schema
        const tableInfo = await db.all("PRAGMA table_info(users)");

        // Check if role column exists
        const roleColumn = tableInfo.find(col => col.name === 'role');
        if (!roleColumn) {
            await db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
        }

        const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin';
        const hashedPassword = bcrypt.hashSync(adminPassword, 10);

        // Now create or update admin user
        const adminUser = await db.get("SELECT * FROM users WHERE email = 'admin@kuwait-travel.com'");

        if (adminUser) {
            // Update existing admin user
            await db.run(
                "UPDATE users SET password = ?, role = 'admin' WHERE email = 'admin@kuwait-travel.com'",
                [hashedPassword]
            );
            console.log('✅ Admin user updated successfully with hashed password!');
        } else {
            // Create new admin user
            await db.run(
                "INSERT INTO users (name, email, password, phone, role, account_type) VALUES (?, ?, ?, ?, ?, ?)",
                ['Admin', 'admin@kuwait-travel.com', hashedPassword, '00000000000', 'admin', 'individual']
            );
            console.log('✅ Admin user created successfully with hashed password!');
        }

        console.log('📧 Email: admin@kuwait-travel.com');
        console.log('🔑 Password: [CONFIGURED_AND_HASHED]');

        // Verify the admin user exists without logging password
        const verifyAdmin = await db.get("SELECT id, name, email, role FROM users WHERE email = 'admin@kuwait-travel.com'");
        console.log('Admin user verified:', verifyAdmin);
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
})();
