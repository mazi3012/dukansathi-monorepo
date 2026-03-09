import { BaseRepository } from './baseRepository';
import { getDB, persistDB } from '../sqlite';
import { syncEngine } from './syncEngine';

export class SaleRepository extends BaseRepository {
    constructor() {
        super('sales');
    }

    // Custom create to handle the complex sale object and trigger sync
    async createSale(saleData, items) {
        const db = getDB();
        const now = new Date().toISOString();

        // 1. Insert Sale
        const saleSql = `
            INSERT INTO sales (id, user_id, customer_id, invoice_type, subtotal, discount_amount, 
                             total_tax_amount, total_amount, payment_method, payment_status, 
                             amount_paid, balance_due, created_at, updated_at, is_synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `;

        db.run(saleSql, [
            saleData.id,
            saleData.user_id,
            saleData.customer_id,
            saleData.invoice_type,
            saleData.subtotal,
            saleData.discount_amount || 0,
            saleData.total_tax_amount || 0,
            saleData.total_amount,
            saleData.payment_method,
            saleData.payment_status,
            saleData.amount_paid || 0,
            saleData.balance_due || 0,
            now, now
        ]);

        // 2. Insert Items
        for (const item of items) {
            const itemSql = `
                INSERT INTO sale_items (id, user_id, sale_id, product_id, quantity, unit_price, total_price, created_at, updated_at, is_synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `;
            const itemId = Date.now() + Math.random();
            db.run(itemSql, [
                itemId,
                saleData.user_id,
                saleData.id,
                item.product_id,
                item.quantity,
                item.unit_price,
                item.total_price,
                now, now
            ]);
        }

        await persistDB();

        // Background sync
        if (navigator.onLine) {
            syncEngine.push('sales');
            syncEngine.push('sale_items');
        }

        return saleData.id;
    }
    async updateStock(productId, change) {
        const db = getDB();
        const now = new Date().toISOString();
        db.run(`UPDATE products SET stock_quantity = stock_quantity + ?, is_synced = 0, updated_at = ? WHERE id = ?`,
            [change, now, productId]);
        await persistDB();
        if (navigator.onLine) {
            syncEngine.push('products');
        }
    }

    async delete(id) {
        const db = getDB();
        const { id: saleId, user_id: userId } = await this.getById(id) || {};

        // 1. Record deletions for both tables
        db.run(`INSERT OR REPLACE INTO deleted_records (id, table_name, user_id, deleted_at) VALUES (?, ?, ?, ?)`,
            [id.toString(), 'sales', userId, new Date().toISOString()]);

        // Get sale items to track their deletions too
        const itemsResult = db.exec(`SELECT id FROM sale_items WHERE sale_id = ?`, [id]);
        if (itemsResult.length > 0) {
            for (const row of itemsResult[0].values) {
                db.run(`INSERT OR REPLACE INTO deleted_records (id, table_name, user_id, deleted_at) VALUES (?, ?, ?, ?)`,
                    [row[0].toString(), 'sale_items', userId, new Date().toISOString()]);
            }
        }

        // 2. Delete locally
        db.run(`DELETE FROM sales WHERE id = ?`, [id]);
        db.run(`DELETE FROM sale_items WHERE sale_id = ?`, [id]);

        await persistDB();

        // 3. Trigger instant sync
        if (navigator.onLine) {
            syncEngine.pushDeletions('sales').catch(err => console.error("Sales deletion sync failed:", err));
            syncEngine.pushDeletions('sale_items').catch(err => console.error("Sale items deletion sync failed:", err));
        }
    }
}

export const saleRepo = new SaleRepository();
