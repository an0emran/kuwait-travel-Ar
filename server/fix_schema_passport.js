import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function migrate() {
    const db = await open({
        filename: './data.sqlite',
        driver: sqlite3.Database
    });

    console.log('Adding new columns for Passport/ID flow...');

    try {
        await db.exec(`ALTER TABLE bookings ADD COLUMN age INTEGER`);
        console.log('Added age column');
    } catch (e) { console.log('age column might already exist'); }

    try {
        await db.exec(`ALTER TABLE bookings ADD COLUMN date_of_birth TEXT`);
        console.log('Added date_of_birth column');
    } catch (e) { console.log('date_of_birth column might already exist'); }

    try {
        await db.exec(`ALTER TABLE bookings ADD COLUMN place_of_birth TEXT`);
        console.log('Added place_of_birth column');
    } catch (e) { console.log('place_of_birth column might already exist'); }

    try {
        await db.exec(`ALTER TABLE bookings ADD COLUMN service_subtype TEXT`);
        console.log('Added service_subtype column');
    } catch (e) { console.log('service_subtype column might already exist'); }

    console.log('Migration complete.');
}

migrate();
