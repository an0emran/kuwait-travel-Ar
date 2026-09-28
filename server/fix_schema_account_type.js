import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function migrate() {
    const db = await open({
        filename: './auth.sqlite',
        driver: sqlite3.Database
    });

    console.log('Adding account_type column to users...');

    try {
        await db.exec(`ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'individual'`);
        console.log('Added account_type column');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('account_type column already exists');
        } else {
            console.error('Error adding column:', e);
        }
    }

    console.log('Migration complete.');
}

migrate();
