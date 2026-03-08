import initSqlJs from 'sql.js';
import { SCHEMA_SQL } from './db/schema';
import localforage from 'localforage';

let db = null;
let SQL = null;

const DB_VERSION = 2; // Incremented for new GST schema columns

export const initSQLite = async () => {
    if (db) return db;

    SQL = await initSqlJs({
        locateFile: file => {
            if (file.endsWith('.wasm')) return '/sql-wasm.wasm';
            return `/${file}`;
        }
    });

    const savedDB = await localforage.getItem('dukan_sqlite_v1');
    const savedVersion = await localforage.getItem('dukan_sqlite_version');

    if (savedDB && savedVersion === DB_VERSION) {
        db = new SQL.Database(new Uint8Array(savedDB));
        console.log("SQLite Restored from Persistence (Version " + DB_VERSION + ")");
    } else {
        if (savedVersion !== DB_VERSION) {
            console.log(`SQLite Version Mismatch (Old: ${savedVersion || 'None'}, New: ${DB_VERSION}). Upgrading Schema...`);
            await localforage.removeItem('dukan_sqlite_v1');
        }
        db = new SQL.Database();
        db.run(SCHEMA_SQL);
        console.log("SQLite Initialized with Fresh Schema (Version " + DB_VERSION + ")");
        await localforage.setItem('dukan_sqlite_version', DB_VERSION);
        await persistDB();
    }

    return db;
};

export const getDB = () => {
    if (!db) throw new Error("Database not initialized. Call initSQLite first.");
    return db;
};

// Helper to save DB state to localforage
export const persistDB = async () => {
    if (!db) return;
    try {
        const binaryArray = db.export();
        await localforage.setItem('dukan_sqlite_v1', binaryArray);
        console.log("SQLite Persisted Successfully");
    } catch (err) {
        console.error("Failed to persist SQLite:", err);
    }
};
