import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function migrate() {
    const db = await open({
        filename: './data.sqlite',
        driver: sqlite3.Database
    });

    console.log('Adding destination column...');

    try {
        await db.exec(`ALTER TABLE bookings ADD COLUMN destination TEXT`);
        console.log('Added destination column');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('destination column already exists');
        } else {
            console.error('Error adding column:', e);
        }
    }

    console.log('Migration complete.');
}

migrate();
