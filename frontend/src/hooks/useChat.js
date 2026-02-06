import { useState, useEffect, useRef, useCallback } from 'react';

export const useChat = () => {
    const [messages, setMessages] = useState([
        { type: 'ai', text: 'Namaste! Main Sathi AI hoon. Boliye main aapki kya madad kar sakta hoon?' }
    ]);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [ws, setWs] = useState(null);

    // Refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

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
                        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                        audio.play().catch(e => console.error("Audio error:", e));
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
        };
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
            access_token: session?.access_token // Sending token too just in case
        }));
        setMessages(prev => [...prev, { type: 'user', text }]);
    }, [ws]);

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
                                access_token: session?.access_token
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
        setMessages
    };
};
