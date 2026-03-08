// file:///e:/dukanv22/frontend/src/lib/db/customerRepository.js
import { BaseRepository } from './baseRepository';
import { getDB, persistDB } from '../sqlite';
import { syncEngine } from './syncEngine';

export class CustomerRepository extends BaseRepository {
    constructor() {
        super('customers');
    }

    async updateBalance(id, amount, type) {
        const db = getDB();
        const multiplier = type === 'credit' ? 1 : -1;
        const now = new Date().toISOString();
        db.run(`UPDATE customers SET credit_balance = credit_balance + ?, is_synced = 0, updated_at = ? WHERE id = ?`,
            [amount * multiplier, now, id]);

        await persistDB();

        if (navigator.onLine) {
            syncEngine.push('customers');
        }
    }

    async addLedgerEntry(entry) {
        const db = getDB();
        const now = new Date().toISOString();
        const id = entry.id || Date.now();

        const sql = `
            INSERT INTO customer_ledger (id, user_id, customer_id, amount, type, mode, note, created_at, updated_at, is_synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `;

        db.run(sql, [
            id,
            entry.user_id,
            entry.customer_id,
            entry.amount,
            entry.type,
            entry.mode || 'Cash',
            entry.note,
            now, now
        ]);

        // Also update the customer balance locally
        await this.updateBalance(entry.customer_id, entry.amount, entry.type);

        await persistDB();

        if (navigator.onLine) {
            syncEngine.push('customer_ledger');
        }
    }

    async delete(id) {
        const db = getDB();
        db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
        await persistDB();

        if (navigator.onLine) {
            syncEngine.push('customers');
        }
        // In local-first, the cloud delete should ideally be handled via a 'deleted' flag 
        // for full sync, but for now we just push local state or handle separately.
        // For simplicity here, we assume the cloud will sync the absence or we push.
    }

    async findByPhone(phone) {
        const db = getDB();
        const result = db.exec(`SELECT * FROM customers WHERE phone = ?`, [phone]);
        if (result.length === 0) return null;
        const columns = result[0].columns;
        const v = result[0].values[0];
        const obj = {};
        columns.forEach((col, i) => obj[col] = v[i]);
        return obj;
    }
}

export const customerRepo = new CustomerRepository();
