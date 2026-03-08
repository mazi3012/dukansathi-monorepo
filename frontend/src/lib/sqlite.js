import initSqlJs from 'sql.js';
import { SCHEMA_SQL } from './db/schema';
import localforage from 'localforage';

let db = null;
let SQL = null;

export const initSQLite = async () => {
    if (db) return db;

    SQL = await initSqlJs({
        locateFile: file => {
            if (file.endsWith('.wasm')) return '/sql-wasm.wasm';
            return `/${file}`;
        }
    });

    const savedDB = await localforage.getItem('dukan_sqlite_v1');

    if (savedDB) {
        db = new SQL.Database(new Uint8Array(savedDB));
        console.log("SQLite Restored from Persistence");
    } else {
        db = new SQL.Database();
        db.run(SCHEMA_SQL);
        console.log("SQLite Initialized with Fresh Schema");
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
