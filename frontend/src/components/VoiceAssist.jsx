import React, { useState, useEffect, useRef } from 'react';

const VoiceAssist = () => {
    const [isListening, setIsListening] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [messages, setMessages] = useState([
        { type: 'ai', text: 'Namaste! Main Moltbot hoon. Boliye main aapki kya madad kar sakta hoon?' }
    ]);
    const [ws, setWs] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const fileInputRef = useRef(null);

    // Connect to WebSocket on mount
    useEffect(() => {
        let wsUrl = import.meta.env.VITE_BACKEND_WS_URL;
        if (!wsUrl) {
            const apiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/chat';
        }
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => console.log('✅ Connected to Moltbot');

        // Listen for settings changes
        const handleSettingsChange = () => {
            console.log("Settings changed, next message will use new prefs");
        };
        window.addEventListener('settings-changed', handleSettingsChange);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Received:", data);

            if (data.type === 'text') {
                setMessages(prev => [...prev, { type: 'ai', text: data.content }]);

                // Play audio response if available
                if (data.audio) {
                    const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                    audio.play().catch(e => console.error("Audio play error:", e));
                }
            } else if (data.type === 'transcription') {
                setMessages(prev => {
                    const newMsgs = [...prev];
                    if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].type === 'user-audio') {
                        newMsgs[newMsgs.length - 1] = { type: 'user', text: data.content };
                    } else {
                        newMsgs.push({ type: 'user', text: data.content });
                    }
                    return newMsgs;
                });
            }
        };

        socket.onerror = (error) => console.error('WebSocket Error:', error);

        setWs(socket);

        return () => {
            socket.close();
            window.removeEventListener('settings-changed', handleSettingsChange);
        };
    }, []);

    const startListening = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64Audio = reader.result.split(',')[1];
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        const settings = getSettings();
                        const payload = {
                            type: 'voice',
                            content: base64Audio,
                            ...settings
                        };
                        console.log("📤 Sending Voice Payload:", { ...payload, content: "(base64 hidden)" }); // DEBUG LOG
                        ws.send(JSON.stringify(payload));
                        setMessages(prev => [...prev, { type: 'user-audio', text: '🎤 Processing...' }]);
                    }
                };
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
        } catch (err) {
            console.error("Mic access denied:", err);
            alert("Please enable microphone access");
        }
    };

    const stopListening = () => {
        if (mediaRecorderRef.current && isListening) {
            mediaRecorderRef.current.stop();
            setIsListening(false);
        }
    };

    // Load settings from localStorage
    const getSettings = () => {
        const speed = localStorage.getItem('voice_speed') || '+0%';
        // Backend expects 'voice_rate', frontend/localstorage uses 'voice_speed'
        return {
            voice_id: localStorage.getItem('voice_id') || 'en-IN-PrabhatNeural',
            voice_rate: speed,
            model: localStorage.getItem('model_id') || 'llama-4-scout-17b-16e-instruct-maas'
        };
    };

    const sendTextMessage = () => {
        if (!textInput.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

        const settings = getSettings();
        const payload = {
            type: 'text',
            content: textInput,
            ...settings
        };
        console.log("📤 Sending Text Payload:", payload); // DEBUG LOG
        ws.send(JSON.stringify(payload));

        setMessages(prev => [...prev, { type: 'user', text: textInput }]);
        setTextInput('');
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !ws || ws.readyState !== WebSocket.OPEN) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64Image = reader.result.split(',')[1];
            ws.send(JSON.stringify({
                type: 'image',
                content: base64Image,
                filename: file.name
            }));
            setMessages(prev => [...prev, { type: 'user', text: '📷 Image uploaded', image: reader.result }]);
        };
    };

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-white font-sans overflow-hidden relative">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-black opacity-80 pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 p-6 flex justify-between items-center backdrop-blur-md bg-white/5 border-b border-white/10">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                    Dukan Sathi
                </h1>
                <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        Online
                    </span>
                </div>
            </div>

            {/* Chat Area */}
            <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex ${msg.type === 'user' || msg.type === 'user-audio' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-lg backdrop-blur-sm border ${msg.type === 'user' || msg.type === 'user-audio'
                                ? 'bg-indigo-600/80 border-indigo-500/50 text-white rounded-br-none'
                                : 'bg-slate-800/80 border-white/10 text-gray-100 rounded-bl-none'
                                }`}
                        >
                            {msg.image && <img src={msg.image} alt="uploaded" className="max-w-xs rounded-lg mb-2" />}
                            {msg.text}
                            {msg.type === 'user-audio' && <span className="ml-2 animate-pulse">...</span>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Input Area */}
            <div className="relative z-10 p-4 bg-gradient-to-t from-slate-900 to-transparent">
                {/* Text Input Row */}
                <div className="flex gap-3 items-center mb-4 backdrop-blur-md bg-white/5 rounded-2xl p-3 border border-white/10">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 rounded-xl bg-purple-600/80 hover:bg-purple-500 transition-all"
                        title="Upload Image"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                        </svg>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                    />
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendTextMessage()}
                        placeholder="Type a message..."
                        className="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
                    />
                    <button
                        onClick={sendTextMessage}
                        className="p-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </div>

                {/* Voice Button */}
                <div className="flex justify-center items-center">
                    <button
                        onMouseDown={startListening}
                        onMouseUp={stopListening}
                        onTouchStart={startListening}
                        onTouchEnd={stopListening}
                        className={`
              w-16 h-16 rounded-full flex items-center justify-center 
              transition-all duration-300 shadow-[0_0_30px_rgba(99,102,241,0.3)]
              border-2 
              ${isListening
                                ? 'bg-red-500/90 border-red-400 scale-110 shadow-[0_0_50px_rgba(239,68,68,0.5)]'
                                : 'bg-indigo-600/90 border-indigo-400 hover:scale-105 hover:bg-indigo-500'
                            }
            `}
                    >
                        {isListening ? (
                            <div className="w-6 h-6 flex gap-1 items-center justify-center">
                                <div className="w-1 h-3 bg-white animate-[bounce_1s_infinite]"></div>
                                <div className="w-1 h-5 bg-white animate-[bounce_1s_infinite_0.1s]"></div>
                                <div className="w-1 h-3 bg-white animate-[bounce_1s_infinite_0.2s]"></div>
                            </div>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        )}
                    </button>
                </div>
                <p className="text-center text-xs text-white/40 font-medium mt-2">
                    {isListening ? "Listening..." : "Hold to Speak"}
                </p>
            </div>
        </div>
    );
};

export default VoiceAssist;
