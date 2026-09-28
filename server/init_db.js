import { authDbPromise, dataDbPromise } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const initDb = async () => {
    try {
        // Initialize Auth DB
        const authDb = await authDbPromise;
        const authSchemaPath = path.join(__dirname, 'schema_auth.sql');
        const authSchema = fs.readFileSync(authSchemaPath, 'utf8');
        await authDb.exec(authSchema);
        console.log('Auth Database initialized successfully');

        // Initialize Data DB
        const dataDb = await dataDbPromise;
        const dataSchemaPath = path.join(__dirname, 'schema_data.sql');
        const dataSchema = fs.readFileSync(dataSchemaPath, 'utf8');
        await dataDb.exec(dataSchema);
        console.log('Data Database initialized successfully');

    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

initDb();
