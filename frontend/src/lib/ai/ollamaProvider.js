export const ollamaProvider = {
    baseUrl: 'http://localhost:11434',

    async chat(messages, model = 'phi3:mini', options = {}) {
        try {
            console.log(`🤖 PWA Agent: Chatting with Ollama (${model})...`);
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 256,
                        ...options
                    }
                }),
                mode: 'cors'
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Ollama Error: ${err}`);
            }

            const data = await response.json();
            return data.message.content;
        } catch (err) {
            console.error('❌ Ollama Provider Error:', err);
            throw err;
        }
    },

    async generate(prompt, model = 'phi3:mini', options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,
                        ...options
                    }
                }),
                mode: 'cors'
            });

            if (!response.ok) throw new Error('Ollama connection failed');
            const data = await response.json();
            return data.response;
        } catch (err) {
            console.error('❌ Ollama Generate Error:', err);
            throw err;
        }
    }
};
