// file:///e:/dukanv22/frontend/src/lib/db/productRepository.js
import { BaseRepository } from './baseRepository';
import { getDB } from '../sqlite';

export class ProductRepository extends BaseRepository {
    constructor() {
        super('products');
    }

    async search(query) {
        const db = getDB();
        const sql = `SELECT * FROM products WHERE name LIKE ? OR category LIKE ? OR barcode = ? ORDER BY name ASC`;
        const searchTerm = `%${query}%`;
        const result = db.exec(sql, [searchTerm, searchTerm, query]);

        if (result.length === 0) return [];
        const columns = result[0].columns;
        return result[0].values.map(v => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = v[i]);
            return obj;
        });
    }

    async updateStock(id, change) {
        const db = getDB();
        db.run(`UPDATE products SET stock_quantity = stock_quantity + ?, is_synced = 0, updated_at = ? WHERE id = ?`,
            [change, new Date().toISOString(), id]);
        // persistDB is called inside upsert/delete, but here we do it manually or via a helper
    }
}

export const productRepo = new ProductRepository();
