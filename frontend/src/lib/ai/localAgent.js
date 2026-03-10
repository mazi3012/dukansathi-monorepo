import { ollamaProvider } from './ollamaProvider';
import { webAiProvider } from './webAiProvider';
import { getDB } from '../sqlite';

const SYSTEM_PROMPT = `
You are Dukan Sathi AI, a shop assistant. 
RULES:
1. Reply in English or Hinglish (Hindi in Roman script).
2. NEVER use Devanagari script.
3. Max 2 short sentences.
4. For amounts, use "rupees", "lakh", or "crore".
5. Be polite and helpful.
`;

// Full SQLite Schema for the AI to understand the current local context
const SQL_SCHEMA = `
  TABLES:
  - customers (id, user_id, name, phone, email, address, gstin, state, credit_balance, created_at, updated_at, is_synced)
  - products (id, user_id, name, description, sku, barcode, category, unit, cost_price, selling_price, mrp, stock_quantity, min_stock_level, tax_percent, hsn_code, is_gst_applicable, tax_type, image_url, created_at, updated_at, is_synced)
  - sales (id, user_id, customer_id, invoice_type, subtotal, discount_amount, total_tax_amount, total_amount, payment_method, payment_status, amount_paid, balance_due, created_at, updated_at, is_synced)
  - sale_items (id, user_id, sale_id, product_id, quantity, unit_price, total_price, created_at, updated_at, is_synced)
  - customer_ledger (id, user_id, customer_id, amount, type, mode, note, created_at, updated_at, is_synced)
`;

export const localAgent = {
    async process(text, history = [], model = 'phi3:mini') {
        try {
            const category = this.categorize(text);
            console.log(`🔍 Local Agent Category: ${category}`);

            // If it's a DML operation (add/update), force BUSINESS category
            const isDML = /add|new|create|register|update|change|set|edit|insert/i.test(text);
            const effectiveCategory = isDML ? 'BUSINESS' : category;

            if (effectiveCategory === 'BUSINESS') {
                return await this.handleBusinessQuery(text, model);
            }

            // Casual chat or greeting
            const messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...history.slice(-4).map(m => ({ role: m.type === 'ai' ? 'assistant' : 'user', content: m.text })),
                { role: 'user', content: text }
            ];

            // Priority 1: Web AI
            if (await webAiProvider.isAvailable()) {
                try {
                    return await webAiProvider.chat(messages);
                } catch (err) {
                    console.warn("Web AI failed, falling back to Ollama...");
                }
            }

            // Priority 2: Ollama
            return await ollamaProvider.chat(messages, model);
        } catch (err) {
            console.error('❌ Local Agent Error:', err);
            return "Maaf kijiye, kuch technical error aa gaya. Please check if Ollama is running.";
        }
    },

    categorize(text) {
        const t = text.toLowerCase();
        const businessKeywords = ['price', 'stock', 'quantity', 'how many', 'inventory', 'customer', 'bill', 'sale', 'bhao', 'kitna', 'maal', 'paisa'];
        if (businessKeywords.some(k => t.includes(k))) return 'BUSINESS';
        return 'CHAT';
    },

    async handleBusinessQuery(text, model) {
        // Step 1: Generate SQL
        const sqlPrompt = `
        SYSTEM: You are a SQLite expert for Dukan Sathi. 
        Output ONLY the SQL query. No markdown, no explanations. 
        ${SQL_SCHEMA}
        QUERY: "${text}"
        SQL:`;

        let sql = "";
        // Priority 1: Web AI for SQL Gen
        if (await webAiProvider.isAvailable()) {
            try {
                sql = await webAiProvider.generate(sqlPrompt);
            } catch (err) {
                console.warn("Web AI SQL Gen failed, falling back to Ollama...");
            }
        }

        // Priority 2: Ollama for SQL Gen
        if (!sql) {
            sql = await ollamaProvider.generate(sqlPrompt, model);
        }

        let cleanSql = sql.replace(/```sql|```/g, '').trim();
        // Take only the first SQL statement if LLM appends conversational text
        const firstSemicolon = cleanSql.indexOf(';');
        if (firstSemicolon !== -1) {
            cleanSql = cleanSql.substring(0, firstSemicolon).trim();
        }
        console.log(`📜 Generated Local SQL: ${cleanSql}`);

        const isDML = /insert|update|delete/i.test(cleanSql);

        // Step 2: Execute SQL
        try {
            const db = await getDB();

            if (isDML) {
                // Pre-process DML: Inject metadata
                const tables = ['products', 'customers', 'sales', 'sale_items', 'customer_ledger'];
                let finalSql = cleanSql;

                // 1. Handle INSERT: Add ID, UserID, and is_synced=0
                if (cleanSql.toLowerCase().startsWith('insert')) {
                    const tableMatch = cleanSql.match(/into\s+(\w+)/i);
                    const tableName = tableMatch ? tableMatch[1].toLowerCase() : null;

                    if (tables.includes(tableName)) {
                        const newId = Date.now() + Math.floor(Math.random() * 1000);
                        const userId = localStorage.getItem('user_id') || '00000000-0000-0000-0000-000000000000';

                        // Parse column/value parts
                        const parts = cleanSql.match(/insert\s+into\s+\w+\s*\((.*?)\)\s*values\s*\((.*)\)/i);
                        if (parts) {
                            const colsStr = parts[1];
                            const valsStr = parts[2];

                            // Simple split but avoid duplicates
                            const cols = colsStr.split(',').map(c => c.trim().toLowerCase());
                            const vals = valsStr.split(',').map(v => v.trim());

                            if (!cols.includes('id')) {
                                cols.push('id');
                                vals.push(`'${newId}'`);
                            }
                            if (!cols.includes('user_id')) {
                                cols.push('user_id');
                                vals.push(`'${userId}'`);
                            }
                            if (!cols.includes('is_synced')) {
                                cols.push('is_synced');
                                vals.push('0');
                            }
                            if (!cols.includes('updated_at')) {
                                cols.push('updated_at');
                                vals.push(`datetime('now')`);
                            }
                            if (!cols.includes('created_at')) { // Added created_at for INSERT
                                cols.push('created_at');
                                vals.push(`datetime('now')`);
                            }

                            finalSql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
                        }
                    }
                } else if (cleanSql.toLowerCase().startsWith('update')) {
                    // 2. Handle UPDATE: Set is_synced=0 and updated_at
                    if (finalSql.toLowerCase().includes(' set ')) {
                        // Avoid double injectors if LLM already tried (unlikely)
                        if (!finalSql.toLowerCase().includes('is_synced')) {
                            finalSql = finalSql.replace(/ set /i, " SET is_synced = 0, updated_at = datetime('now'), ");
                        }
                    }
                }

                console.log(`📝 Processed local DML: ${finalSql}`);
                db.run(finalSql);
                const { persistDB } = await import('../sqlite');
                await persistDB();

                return `Done Boss! Your information has been saved locally. I'll sync it with the cloud once the internet is back.`;
            }

            // SELECT lookup
            // Pre-process SQL for offline drafting (INSERT/UPDATE)
            let finalSql = cleanSql; // Use cleanSql here, as 'sql' might contain markdown or extra text
            if (cleanSql.toUpperCase().includes('INSERT') || cleanSql.toUpperCase().includes('UPDATE')) {
                const userId = (await authService.getCurrentUser())?.id || 'anon';
                const now = new Date().toISOString();

                // 1. Ensure user_id is present in INSERTs
                if (cleanSql.toUpperCase().includes('INSERT') && !cleanSql.includes('user_id')) {
                    // Simplistic injection for common patterns
                    finalSql = cleanSql.replace(/\((.*?)\)\s*VALUES\s*\((.*?)\)/gi, (match, cols, vals) => {
                        return `(${cols}, user_id, created_at, updated_at, is_synced) VALUES (${vals}, '${userId}', '${now}', '${now}', 0)`;
                    });
                } else if (cleanSql.toUpperCase().includes('UPDATE')) {
                    // Ensure is_synced=0 and updated_at is updated
                    if (!cleanSql.includes('is_synced')) {
                        finalSql = cleanSql.replace(/SET\s+/gi, `SET is_synced = 0, updated_at = '${now}', `);
                    }
                }
            }

            const result = db.exec(finalSql);
            const { persistDB } = await import('../sqlite'); // Re-import if needed, or ensure it's available
            await persistDB();

            // Push if online
            if (navigator.onLine) {
                syncEngine.syncAll();
            }
            const data = result.length > 0 ? result[0].values : [];
            if (data.length === 0) return "Mujhe is baare mein koi data nahi mila.";

            const summaryPrompt = `
            SYSTEM: ${SYSTEM_PROMPT}
            DATA FROM DATABASE: ${JSON.stringify(data)}
            USER QUESTION: ${text}
            Summarize this for the user:`;

            // Priority 1: Web AI for Summary
            if (await webAiProvider.isAvailable()) {
                try {
                    return await webAiProvider.generate(summaryPrompt);
                } catch (err) {
                    console.warn("Web AI summary failed, falling back to Ollama...");
                }
            }

            // Priority 2: Ollama for Summary
            return await ollamaProvider.generate(summaryPrompt, model);
        } catch (dbErr) {
            console.error('DB Error:', dbErr);
            return "Data check karne mein dikkat hui. Please check your query syntax.";
        }
    }
};
