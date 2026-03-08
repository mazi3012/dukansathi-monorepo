// file:///e:/dukanv22/frontend/src/lib/db/customerRepository.js
import { BaseRepository } from './baseRepository';
import { getDB } from '../sqlite';

export class CustomerRepository extends BaseRepository {
    constructor() {
        super('customers');
    }

    async updateBalance(id, amount, type) {
        const db = getDB();
        const multiplier = type === 'credit' ? 1 : -1;
        db.run(`UPDATE customers SET credit_balance = credit_balance + ?, is_synced = 0, updated_at = ? WHERE id = ?`,
            [amount * multiplier, new Date().toISOString(), id]);
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
