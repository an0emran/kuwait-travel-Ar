import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function migrate() {
    const db = await open({
        filename: './data.sqlite',
        driver: sqlite3.Database
    });

    console.log('Creating notifications table...');

    try {
        await db.exec(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'general',
                is_read BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created notifications table');
    } catch (e) {
        console.error('Error creating table:', e);
    }

    console.log('Migration complete.');
}

migrate();
