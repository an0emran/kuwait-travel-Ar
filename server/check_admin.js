import { authDbPromise } from './db.js';

(async () => {
    try {
        const db = await authDbPromise;
        const admins = await db.all("SELECT id, name, email, role, created_at FROM users WHERE role = 'admin'");
        console.log('Admins found (count):', admins.length);
        console.log('Admins list:', admins);
    } catch (err) {
        console.error('Error:', err);
    }
})();
