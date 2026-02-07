import { useState, useEffect, useRef, useCallback } from 'react';

export const useChat = () => {
    const [messages, setMessages] = useState([
        { type: 'ai', text: 'Namaste! Main Sathi AI hoon. Boliye main aapki kya madad kar sakta hoon?' }
    ]);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [ws, setWs] = useState(null);
    const [voice, setVoice] = useState(localStorage.getItem('voice_id') || 'hi-IN-MadhurNeural');

    // Function to change voice
    const changeVoice = (newVoice) => {
        setVoice(newVoice);
        localStorage.setItem('voice_id', newVoice);
    };

    // Refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const lastAudioRef = useRef(null);

    useEffect(() => {
        const wsUrl = import.meta.env.VITE_BACKEND_WS_URL || 'ws://localhost:8000/ws/chat';
        const socket = new WebSocket(wsUrl);

        // Fetch User & Chat History
        const initChat = async () => {
            const { supabase } = await import('../lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user?.id) {
                // Fetch last 12 hours history
                const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

                const { data: history, error } = await supabase
                    .from('chat_history')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .gte('created_at', twelveHoursAgo)
                    .order('created_at', { ascending: true });

                if (!error && history?.length > 0) {
                    const formattedHistory = history.map(msg => ({
                        type: msg.role === 'assistant' ? 'ai' : 'user',
                        text: msg.message
                    }));
                    setMessages(formattedHistory);
                } else {
                    setMessages([
                        { type: 'ai', text: 'Namaste! Main Sathi AI hoon. Boliye main aapki kya madad kar sakta hoon?' }
                    ]);
                }
            }
        };

        initChat();

        socket.onopen = () => console.log('✅ Connected to Chat WS');

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'text') {
                    setIsThinking(false);
                    setMessages(prev => [...prev, { type: 'ai', text: data.content }]);

                    // Play Audio if present
                    if (data.audio) {
                        console.log("🔊 Received audio data, attempting playback...");
                        playAudio(data.audio);
                    }
                } else if (data.type === 'transcription') {
                    // Update the last "user-audio" placeholder or add new
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        const lastMsg = newMsgs[newMsgs.length - 1];

                        if (lastMsg && lastMsg.type === 'user-audio') {
                            // Replace placeholder
                            newMsgs[newMsgs.length - 1] = { type: 'user', text: data.content };
                        } else {
                            newMsgs.push({ type: 'user', text: data.content });
                        }
                        return newMsgs;
                    });
                    // After transcription, the AI is processing the answer, so set Thinking
                    setIsThinking(true);
                }
            } catch (e) {
                console.error("WS Parse Error", e);
                setIsThinking(false);
            }
        };

        setWs(socket);

        return () => {
            socket.close();
            if (lastAudioRef.current) {
                lastAudioRef.current.pause();
                if (lastAudioRef.current.src) URL.revokeObjectURL(lastAudioRef.current.src);
            }
        };
    }, []);

    // Helper: Play Base64 Audio with Blob/URL
    const playAudio = useCallback((base64Data) => {
        try {
            // Stop any existing audio
            if (lastAudioRef.current) {
                lastAudioRef.current.pause();
                if (lastAudioRef.current.src) URL.revokeObjectURL(lastAudioRef.current.src);
                lastAudioRef.current = null;
            }

            // Convert Base64 to Blob
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            const audio = new Audio(url);
            lastAudioRef.current = audio;

            audio.onplay = () => console.log("✅ Audio playback started successfully");
            audio.onerror = (e) => console.error("❌ Audio Error:", e);

            audio.play().catch(err => {
                console.warn("⚠️ Audio.play() blocked by browser. This usually requires a user click first.");
                console.error(err);
            });
        } catch (err) {
            console.error("❌ Error in playAudio helper:", err);
        }
    }, []);

    const sendMessage = useCallback(async (text) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        setIsThinking(true);

        // Get current user ID
        const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
        const userId = session?.user?.id || 'anon';

        ws.send(JSON.stringify({
            type: 'text',
            content: text,
            user_id: userId,
            access_token: session?.access_token, // Sending token too just in case
            voice_id: voice
        }));
        setMessages(prev => [...prev, { type: 'user', text }]);
    }, [ws, voice]);

    const sendImage = useCallback(async (file) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        setIsThinking(true);

        // Get current user ID
        const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
        const userId = session?.user?.id || 'anon';

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            ws.send(JSON.stringify({
                type: 'image',
                content: base64,
                filename: file.name,
                user_id: userId,
                access_token: session?.access_token
            }));
            setMessages(prev => [...prev, { type: 'user', text: '📷 Image Sent', image: reader.result }]);
        };
    }, [ws]);

    // Simplified Audio Recording Logic
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
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        // Get user ID async inside the callback
                        import('../lib/supabase').then(m => m.supabase.auth.getSession()).then(({ data: { session } }) => {
                            const userId = session?.user?.id || 'anon';
                            ws.send(JSON.stringify({
                                type: 'voice',
                                content: base64,
                                user_id: userId,
                                access_token: session?.access_token,
                                voice_id: voice
                            }));
                        });
                        setMessages(prev => [...prev, { type: 'user-audio', text: '🎤 ...' }]);
                    }
                };
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error("Mic Error", e);
            alert("Mic Access Denied");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isListening) {
            mediaRecorderRef.current.stop();
            setIsListening(false);
        }
    };

    return {
        messages,
        sendMessage,
        sendImage,
        startRecording,
        stopRecording,
        isListening,
        isThinking,
        setMessages,
        voice,
        changeVoice
    };
};
