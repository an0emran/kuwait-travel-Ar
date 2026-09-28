
import { dataDbPromise } from './db.js';

const fixSchemaHajj = async () => {
    try {
        const db = await dataDbPromise;

        const columns = [
            "days INTEGER",
            "package_type TEXT",
            "travel_method TEXT",
            "passport_image_path TEXT",
            "payment_method TEXT"
        ];

        for (const col of columns) {
            try {
                await db.run(`ALTER TABLE bookings ADD COLUMN ${col}`);
                console.log(`Added column: ${col}`);
            } catch (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Column already exists: ${col}`);
                } else {
                    console.error(`Failed to add ${col}:`, err.message);
                }
            }
        }
        console.log("Migration completed.");
    } catch (err) {
        console.error("Migration failed:", err.message);
    }
};

fixSchemaHajj();
