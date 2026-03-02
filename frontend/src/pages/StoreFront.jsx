import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, Square, Send, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StoreFront() {
    const { storeId } = useParams();
    const [messages, setMessages] = useState([
        { type: 'ai', text: 'Namaste! Welcome to our store. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const lastAudioRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // WebSocket Connection
    useEffect(() => {
        let wsUrl = import.meta.env.VITE_BACKEND_WS_URL;
        if (!wsUrl) {
            const apiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws';
        }
        // Replace base /ws or /ws/chat with our customer endpoint
        const customerWsUrl = wsUrl.replace(/\/ws(\/chat)?$/, `/ws/customer_chat/${storeId}`);

        const socket = new WebSocket(customerWsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
            console.log('✅ Connected to Customer WS');
            setIsConnected(true);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'text') {
                    // Stop previous audio
                    if (lastAudioRef.current) {
                        lastAudioRef.current.pause();
                        lastAudioRef.current.currentTime = 0;
                    }

                    // Play new audio if present
                    if (data.audio) {
                        const snd = new Audio("data:audio/wav;base64," + data.audio);
                        snd.play().catch(e => console.warn("Audio autoplay blocked:", e));
                        lastAudioRef.current = snd;
                    }

                    setMessages(prev => {
                        const newMsgs = [...prev];
                        // Replace transcribe loader if present
                        if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].type === 'user-audio') {
                            newMsgs[newMsgs.length - 1] = { type: 'user', text: "🎤 (Voice Message)" };
                        }
                        return [...newMsgs, { type: 'ai', text: data.content }];
                    });

                    // Add draft invoice note if order was placed
                    if (data.attachment && data.attachment.draft_type === "invoice") {
                        setMessages(prev => [...prev, {
                            type: 'ai',
                            text: '🛒 Your order request has been sent to the store owner!'
                        }]);
                    }
                } else if (data.type === 'transcription') {
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].type === 'user-audio') {
                            newMsgs[newMsgs.length - 1] = { type: 'user', text: `🎤 ${data.content}` };
                        }
                        return newMsgs;
                    });
                } else if (data.type === 'error') {
                    setMessages(prev => [...prev, { type: 'error', text: data.content }]);
                }
            } catch (err) {
                console.error("Message parse error", err);
            }
        };

        socket.onclose = () => {
            console.log("WS Closed");
            setIsConnected(false);
        };

        // Unlock audio context for mobile browsers
        const unlockAudio = () => {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                const ctx = new AudioContext();
                ctx.resume();
            }
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
        };
        document.addEventListener('click', unlockAudio);
        document.addEventListener('touchstart', unlockAudio);

        return () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
        };
    }, [storeId]);

    const sendText = (e) => {
        e.preventDefault();
        if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // Stop current audio
        if (lastAudioRef.current) {
            lastAudioRef.current.pause();
            lastAudioRef.current.currentTime = 0;
        }

        wsRef.current.send(JSON.stringify({
            type: 'text',
            content: input.trim()
        }));

        setMessages(prev => [...prev, { type: 'user', text: input.trim() }]);
        setInput('');
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({
                            type: 'voice',
                            content: base64
                        }));
                        setMessages(prev => [...prev, { type: 'user-audio', text: '🎤 ...' }]);
                    }
                };
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error("Mic Error", e);
            alert("Please allow microphone access to talk to the store assistant.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isListening) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsListening(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 font-sans">
            {/* Header */}
            <header className="bg-white px-4 py-4 flex items-center shadow-sm z-10 sticky top-0">
                <div className="bg-blue-100 p-2 rounded-full mr-3 text-blue-600">
                    <Store size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-800">Store Assistant</h1>
                    <p className="text-sm text-gray-500 flex items-center">
                        <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {isConnected ? 'Online' : 'Reconnecting...'}
                    </p>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                <AnimatePresence>
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.type.includes('user') ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.type.includes('user')
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : msg.type === 'error'
                                        ? 'bg-red-100 text-red-800 border border-red-200'
                                        : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-none'
                                    }`}
                            >
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-pb pb-8">
                <div className="max-w-3xl mx-auto flex items-end space-x-2">
                    {/* Push to Talk Button */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                        onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
                        onMouseUp={(e) => { e.preventDefault(); stopRecording(); }}
                        onMouseLeave={stopRecording}
                        className={`p-4 rounded-full flex-shrink-0 shadow-lg ${isListening
                            ? 'bg-red-500 text-white animate-pulse shadow-red-200'
                            : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700'
                            } transition-colors`}
                    >
                        {isListening ? <Square size={24} fill="currentColor" /> : <Mic size={24} />}
                    </motion.button>

                    <form onSubmit={sendText} className="flex-1 flex bg-gray-100 rounded-full overflow-hidden items-center pr-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a message..."
                            className="w-full bg-transparent px-4 py-4 outline-none text-gray-800"
                            disabled={!isConnected}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || !isConnected}
                            className={`p-2 rounded-full ${input.trim() && isConnected ? 'bg-blue-600 text-white' : 'text-gray-400'
                                } transition-colors`}
                        >
                            <Send size={20} className={input.trim() ? "translate-x-0.5" : ""} />
                        </button>
                    </form>
                </div>
                <p className="text-center text-xs text-gray-400 mt-3 font-medium tracking-wide">
                    POWERED BY DUKANSATHI AI
                </p>
            </div>
        </div>
    );
}
