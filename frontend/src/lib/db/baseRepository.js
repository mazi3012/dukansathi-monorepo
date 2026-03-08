// file:///e:/dukanv22/frontend/src/lib/db/baseRepository.js
import { getDB, persistDB } from '../sqlite';

export class BaseRepository {
    constructor(tableName) {
        this.tableName = tableName;
    }

    async getAll() {
        const db = getDB();
        const result = db.exec(`SELECT * FROM ${this.tableName} ORDER BY updated_at DESC`);
        if (result.length === 0) return [];

        const columns = result[0].columns;
        return result[0].values.map(v => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = v[i]);
            return obj;
        });
    }

    async getById(id) {
        const db = getDB();
        const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
        stmt.bind([id]);
        if (stmt.step()) {
            const result = stmt.getAsObject();
            stmt.free();
            return result;
        }
        stmt.free();
        return null;
    }

    async upsert(data, isFromCloud = false) {
        const db = getDB();
        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(',');

        // Ensure updated_at and is_synced are handled
        if (!isFromCloud) {
            data.updated_at = new Date().toISOString();
            data.is_synced = 0; // 0 for false in SQLite
        } else {
            data.is_synced = 1; // 1 for true
        }

        const sql = `INSERT OR REPLACE INTO ${this.tableName} (${columns.join(',')}) VALUES (${placeholders})`;
        db.run(sql, Object.values(data));

        await persistDB();
        return data;
    }

    async delete(id) {
        const db = getDB();
        db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
        await persistDB();
    }
}
