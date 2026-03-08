// file:///e:/dukanv22/frontend/src/lib/db/syncEngine.js
import { supabase } from '../supabase';
import { getDB, persistDB } from '../sqlite';

export class SyncEngine {
    constructor() {
        this.tables = ['products', 'customers', 'sales', 'sale_items', 'customer_ledger'];
        this.isSyncing = false;
        this.listeners = [];
        this.syncEnabled = localStorage.getItem('sync_enabled') !== 'false';
    }

    setSyncEnabled(enabled) {
        this.syncEnabled = enabled;
        localStorage.setItem('sync_enabled', enabled ? 'true' : 'false');
    }

    isOffline() {
        return !navigator.onLine;
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify(status) {
        this.listeners.forEach(l => l(status));
    }

    async syncAll() {
        if (this.isSyncing || this.isOffline() || !this.syncEnabled) return;

        this.isSyncing = true;
        this.notify({ status: 'syncing', message: 'Starting Sync...' });
        console.log("Starting Sync Process...");

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                this.notify({ status: 'error', message: 'Not Authenticated' });
                this.isSyncing = false;
                return;
            }

            for (const table of this.tables) {
                this.notify({ status: 'syncing', message: `Syncing ${table}...` });
                await this.pull(table);
                await this.push(table);
            }
            this.notify({ status: 'idle', message: 'Sync Completed' });
            console.log("Sync Process Completed Successfully");
        } catch (error) {
            this.notify({ status: 'error', message: 'Sync Failed' });
            console.error("Sync Process Failed:", error);
        } finally {
            this.isSyncing = false;
        }
    }

    async pull(tableName) {
        const db = getDB();
        // Get last pulled at from sync_metadata
        let lastPulledAt = '1970-01-01T00:00:00Z';
        const metadataResult = db.exec(`SELECT last_pulled_at FROM sync_metadata WHERE table_name = ?`, [tableName]);
        if (metadataResult.length > 0 && metadataResult[0].values[0][0]) {
            lastPulledAt = metadataResult[0].values[0][0];
        }

        // Fetch from Supabase
        const { data: remoteData, error } = await supabase
            .from(tableName)
            .select('*')
            .gt('updated_at', lastPulledAt);

        if (error) throw error;
        if (!remoteData || remoteData.length === 0) return;

        // Upsert into SQLite
        for (const item of remoteData) {
            const columns = Object.keys(item);
            const placeholders = columns.map(() => '?').join(',');
            const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(',')}, is_synced) VALUES (${placeholders}, 1)`;
            db.run(sql, [...Object.values(item)]);
        }

        // Update metadata
        const now = new Date().toISOString();
        db.run(`INSERT OR REPLACE INTO sync_metadata (table_name, last_pulled_at) VALUES (?, ?)`, [tableName, now]);
        await persistDB();
    }

    async push(tableName) {
        if (this.isOffline() || !this.syncEnabled) return;

        const db = getDB();
        // Get unsynced changes
        const result = db.exec(`SELECT * FROM ${tableName} WHERE is_synced = 0`);
        if (result.length === 0) return;

        const columns = result[0].columns;
        const unsyncedItems = result[0].values.map(v => {
            const obj = {};
            columns.forEach((col, i) => {
                if (col !== 'is_synced') obj[col] = v[i];
            });
            return obj;
        });

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        for (const item of unsyncedItems) {
            // Ensure user_id is set for security
            item.user_id = session.user.id;

            const { error } = await supabase
                .from(tableName)
                .upsert(item);

            if (error) {
                console.error(`Failed to push ${tableName} ID ${item.id}:`, error);
                continue;
            }

            // Mark as synced locally
            db.run(`UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`, [item.id]);
        }

        await persistDB();
    }
}

export const syncEngine = new SyncEngine();
