
import bcrypt from 'bcryptjs';
import { authDbPromise } from './db.js';

(async () => {
    try {
        const db = await authDbPromise;
        const user = await db.get("SELECT email, password FROM users WHERE email = 'admin2@kuwait-travel.com'");

        if (!user) {
            console.log('❌ User not found.');
            process.exit(1);
        }

        const isMatch = await bcrypt.compare('admin2026', user.password);
        if (isMatch) {
            console.log('✅ Password hash verified successfully via bcrypt.compare.');
        } else {
            console.log('❌ Password verification failed.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
})();
