import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Canonical database paths (resolves to project root regardless of process.cwd())
const AUTH_DB_PATH = path.resolve(__dirname, '../auth.sqlite');
const DATA_DB_PATH = path.resolve(__dirname, '../data.sqlite');

const authDbPromise = open({
    filename: AUTH_DB_PATH,
    driver: sqlite3.Database
});

const dataDbPromise = open({
    filename: DATA_DB_PATH,
    driver: sqlite3.Database
});

export { authDbPromise, dataDbPromise, AUTH_DB_PATH, DATA_DB_PATH };
