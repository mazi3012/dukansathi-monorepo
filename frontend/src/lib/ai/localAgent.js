import { ollamaProvider } from './ollamaProvider';
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

const SQL_SCHEMA = `
TABLES:
- products (id, name, selling_price, stock_quantity, category)
- customers (id, name, phone, credit_balance)
`;

export const localAgent = {
    async process(text, history = [], model = 'phi3:mini') {
        try {
            const category = this.categorize(text);
            console.log(`🔍 Local Agent Category: ${category}`);

            if (category === 'BUSINESS') {
                return await this.handleBusinessQuery(text, model);
            }

            // Casual chat or greeting
            const messages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...history.slice(-4).map(m => ({ role: m.type === 'ai' ? 'assistant' : 'user', content: m.text })),
                { role: 'user', content: text }
            ];

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
        SYSTEM: You are a SQLite expert. Output ONLY the SELECT query.
        ${SQL_SCHEMA}
        QUERY: "${text}"
        SQL:`;

        const sql = await ollamaProvider.generate(sqlPrompt, model);
        const cleanSql = sql.replace(/```sql|```/g, '').trim();
        console.log(`📜 Generated Local SQL: ${cleanSql}`);

        if (!cleanSql.toLowerCase().startsWith('select')) {
            return "I can only look up information. Please ask about products or customers.";
        }

        // Step 2: Execute SQL
        try {
            const db = await getDB();
            const result = db.exec(cleanSql);
            const data = result.length > 0 ? result[0].values : [];

            // Step 3: Summarize
            if (data.length === 0) return "Mujhe is baare mein koi data nahi mila.";

            const summaryPrompt = `
            SYSTEM: ${SYSTEM_PROMPT}
            DATA FROM DATABASE: ${JSON.stringify(data)}
            USER QUESTION: ${text}
            Summarize this for the user:`;

            return await ollamaProvider.generate(summaryPrompt, model);
        } catch (dbErr) {
            console.error('DB Error:', dbErr);
            return "Data check karne mein dikkat hui. Please check your query.";
        }
    }
};
