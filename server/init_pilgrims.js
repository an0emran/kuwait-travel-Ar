import { dataDbPromise } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDb = await dataDbPromise;

const schemaPath = path.join(__dirname, 'schema_pilgrims.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
await dataDb.exec(schema);

console.log('✅ Pilgrims tables created successfully');
process.exit(0);
