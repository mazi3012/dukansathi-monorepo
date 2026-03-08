/**
 * Provider for Chrome's built-in AI (Gemini Nano / Prompt API)
 * See: https://developer.chrome.com/docs/ai/built-in
 */
export const webAiProvider = {
    session: null,

    async isAvailable() {
        try {
            if (!window.ai || !window.ai.assistant) return false;
            const capabilities = await window.ai.assistant.capabilities();
            return capabilities.available !== 'no';
        } catch (err) {
            console.warn('⚠️ Web AI availability check failed:', err);
            return false;
        }
    },

    async getSession() {
        if (this.session) return this.session;

        try {
            console.log('🤖 PWA Agent: Initializing Web AI Session...');
            this.session = await window.ai.assistant.create();
            return this.session;
        } catch (err) {
            console.error('❌ Failed to create Web AI session:', err);
            throw err;
        }
    },

    async chat(messages, options = {}) {
        try {
            const session = await this.getSession();
            // Prompt API is simpler than Chat completion; we usually pass the last message or a formatted string
            // For now, let's join messages or just take the last one with context
            const lastMessage = messages[messages.length - 1].content;
            console.log('🤖 PWA Agent: Using Web AI (Gemini Nano)...');
            return await session.prompt(lastMessage);
        } catch (err) {
            console.error('❌ Web AI Prompt Error:', err);
            this.session = null; // Reset session on error
            throw err;
        }
    },

    async generate(prompt, options = {}) {
        try {
            const session = await this.getSession();
            return await session.prompt(prompt);
        } catch (err) {
            console.error('❌ Web AI Generate Error:', err);
            this.session = null;
            throw err;
        }
    }
};
