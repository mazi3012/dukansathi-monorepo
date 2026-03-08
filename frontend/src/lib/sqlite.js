// file:///e:/dukanv22/frontend/src/lib/sqlite.js
import initSqlJs from 'sql.js';
import schemaSql from './db/schema.sql?raw';

let db = null;
let SQL = null;

export const initSQLite = async () => {
    if (db) return db;

    SQL = await initSqlJs({
        // Locate the wasm file in the public directory
        locateFile: file => `/${file}`
    });

    // Strategy: Storage in OPFS (Origin Private File System) for persistence
    // For now, we'll use a simpler persistent wrapper or just memory for setup
    // Real implementation would use: const opfsRoot = await navigator.storage.getDirectory();

    db = new SQL.Database();
    db.run(schemaSql);

    console.log("SQLite Initialized with Schema");
    return db;
};

export const getDB = () => {
    if (!db) throw new Error("Database not initialized. Call initSQLite first.");
    return db;
};

// Helper to save DB state to localforage or OPFS
export const persistDB = async () => {
    if (!db) return;
    const binaryArray = db.export();
    // Implementation for OPFS persistence...
    localStorage.setItem('dukan_sqlite_v1', JSON.stringify(Array.from(binaryArray)));
};
