import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { localAgent } from '../lib/ai/localAgent';
import { syncEngine } from '../lib/db/syncEngine';

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [messages, setMessages] = useState(() => {
        return [{ type: 'ai', text: 'Namaste Boss! Main aapka Dukan Sathi AI hoon. Store ka saara hisaar-kitaab mere paas hai. Aaj kya check karna hai?' }];
    });

    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ws, setWs] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [voice, setVoice] = useState(localStorage.getItem('voice_id') || 'hi-IN-MadhurNeural');
    const [voiceSpeed, setVoiceSpeed] = useState(localStorage.getItem('voice_speed') || '+0%');

    let initialModel = localStorage.getItem('model_id') || 'llama-4-scout-17b-16e-instruct-maas';
    if (initialModel.includes('gemini')) {
        initialModel = 'llama-4-scout-17b-16e-instruct-maas';
        localStorage.setItem('model_id', initialModel);
    }
    const [model, setModel] = useState(initialModel);
    const [isMuted, setIsMuted] = useState(localStorage.getItem('isMuted') === 'true');
    const isMutedRef = useRef(localStorage.getItem('isMuted') === 'true');

    const [pendingAttachment, setPendingAttachment] = useState(null);
    const pendingAttachmentRef = useRef(null);

    // Environment Detection
    const isMobile = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0);
    };

    const isPWA = () => {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    };

    // Refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const lastAudioRef = useRef(null);
    const audioContextRef = useRef(null);
    const isRecordingRef = useRef(false);
    const wsRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const onMessageHandlerRef = useRef(null);

    useEffect(() => {
        pendingAttachmentRef.current = pendingAttachment;
    }, [pendingAttachment]);

    // Handle Settings Change
    useEffect(() => {
        const handleSettingsChange = () => {
            setVoice(localStorage.getItem('voice_id') || 'hi-IN-MadhurNeural');
            setVoiceSpeed(localStorage.getItem('voice_speed') || '+0%');
            setModel(localStorage.getItem('model_id') || 'llama-4-scout-17b-16e-instruct-maas');
        };
        window.addEventListener('settings-changed', handleSettingsChange);
        window.addEventListener('storage', handleSettingsChange);
        return () => {
            window.removeEventListener('settings-changed', handleSettingsChange);
            window.removeEventListener('storage', handleSettingsChange);
        };
    }, []);

    const toggleMute = () => {
        setIsMuted(prev => {
            const newState = !prev;
            localStorage.setItem('isMuted', newState);
            isMutedRef.current = newState;
            if (newState && lastAudioRef.current) {
                lastAudioRef.current.pause();
                lastAudioRef.current = null;
            }
            return newState;
        });
    };

    const changeVoice = (newVoice, newSpeed) => {
        setVoice(newVoice);
        if (newSpeed) setVoiceSpeed(newSpeed);
    };

    const unlockAudio = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, []);

    const playAudio = useCallback((base64Data) => {
        if (isMutedRef.current) return;
        try {
            if (lastAudioRef.current) {
                lastAudioRef.current.pause();
                lastAudioRef.current = null;
            }
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
            audio.onplay = () => setIsPlaying(true);
            audio.onended = () => setIsPlaying(false);
            audio.onerror = () => setIsPlaying(false);
            audio.play().catch(() => setIsPlaying(false));
        } catch (err) {
            console.error('❌ playAudio error:', err);
        }
    }, []);

    const speakNative = useCallback((text) => {
        if (isMutedRef.current || !text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('hi-IN') || v.lang.includes('en-IN')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
    }, []);

    const onMessageHandler = useCallback((event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'text' || data.type === 'error') {
                setIsThinking(false);
                const isError = data.type === 'error';
                const aiMessage = {
                    type: 'ai',
                    text: data.content,
                    isError: isError // Frontend can style this differently if needed
                };
                if (data.attachment) aiMessage.attachment = data.attachment;

                // Parse AI messages that are JSON (Invoices)
                try {
                    const parsed = JSON.parse(data.content);
                    if (parsed.pdf_url) {
                        aiMessage.pdf_url = parsed.pdf_url;
                        aiMessage.customer_name = parsed.customer_name;
                        aiMessage.customer_phone = parsed.customer_phone;
                        aiMessage.grand_total = parsed.grand_total;
                        aiMessage.invoice_id = parsed.invoice_id;
                        aiMessage.items_summary = parsed.items_summary;
                        aiMessage.payment_status = parsed.payment_status;
                        aiMessage.amount_paid = parsed.amount_paid;
                        aiMessage.balance_due = parsed.balance_due;
                    }
                } catch (e) { }

                setMessages(prev => [...prev, aiMessage]);
                if (data.audio) playAudio(data.audio);
                else speakNative(data.content);

                // Trigger sync immediately after AI action to refresh local DB
                if (navigator.onLine) {
                    syncEngine.syncAll();
                }
            } else if (data.type === 'image_pending') {
                setIsThinking(false);
                setMessages(prev => [...prev, {
                    type: 'ai',
                    text: data.content,
                    image_url: data.image_url,
                    isImagePrompt: true
                }]);
            } else if (data.type === 'transcription') {
                setMessages(prev => {
                    const newMsgs = [...prev];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg && lastMsg.type === 'user-audio') {
                        newMsgs[newMsgs.length - 1] = { type: 'user', text: data.content };
                    } else {
                        newMsgs.push({ type: 'user', text: data.content });
                    }
                    return newMsgs;
                });
                setIsThinking(true);
            }
        } catch (e) {
            setIsThinking(false);
        }
    }, [playAudio, speakNative]);

    useEffect(() => {
        onMessageHandlerRef.current = onMessageHandler;
    }, [onMessageHandler]);

    const connectWebSocket = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        let wsUrl = import.meta.env.VITE_BACKEND_WS_URL;
        if (!wsUrl) {
            // Smart dynamic fallback: Use current hostname but port 8000
            // This allows mobile devices on same network to connect to the dev machine
            const currentHost = window.location.hostname;
            const apiUrl = import.meta.env.VITE_BACKEND_API_URL || `http://${currentHost}:8000`;
            wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/chat';
        }

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;
        setWs(socket);

        socket.onopen = () => {
            setIsConnected(true);
            reconnectAttemptRef.current = 0;
        };

        socket.onclose = (event) => {
            setIsConnected(false);
            if (!event.wasClean) {
                const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30000);
                reconnectAttemptRef.current += 1;
                reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            setIsConnected(false);
        };

        socket.onmessage = (event) => onMessageHandlerRef.current?.(event);
    }, []);

    useEffect(() => {
        const initChat = async () => {
            const { supabase } = await import('../lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user?.id) {
                const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
                const { data: history } = await supabase
                    .from('chat_history')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .gte('created_at', twelveHoursAgo)
                    .order('created_at', { ascending: true });

                if (history?.length > 0) {
                    const formattedHistory = history.map(msg => {
                        try {
                            const parsedData = JSON.parse(msg.message);
                            if (parsedData && parsedData.pdf_url) {
                                return {
                                    type: msg.role === 'assistant' ? 'ai' : 'user',
                                    text: parsedData.text || '',
                                    ...parsedData
                                };
                            }
                        } catch (e) { }
                        return { type: msg.role === 'assistant' ? 'ai' : 'user', text: msg.message };
                    });
                    setMessages(formattedHistory);
                }

                const { data: profile } = await supabase.from('profiles').select('voice_id, voice_speed').eq('id', session.user.id).single();
                if (profile) {
                    if (profile.voice_id) setVoice(profile.voice_id);
                    if (profile.voice_speed) setVoiceSpeed(profile.voice_speed);
                }
            }
        };

        initChat();
        connectWebSocket();

        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, [connectWebSocket]);

    const sendMessage = useCallback(async (text, attachment = null) => {
        unlockAudio();
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        setIsThinking(true);
        const { supabase } = await import('../lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();

        const isOffline = !navigator.onLine;
        const mobile = isMobile();
        const pwa = isPWA();
        const isLocalModel = model.includes(':');

        // Priority Fix: If Online AND (Mobile OR PWA), ALWAYS use Cloud (Web AI) unless user explicitly chose a local model
        // Actually, user wants PWA and Mobile to use Cloud AI by default until local is selected.
        let activeMode = (isOffline || isLocalModel) ? 'local' : 'cloud';
        let activeModel = model;

        // Force cloud for PWA/Mobile if online and current model is NOT a local one (missing ':')
        if (!isOffline && (mobile || pwa) && !isLocalModel) {
            activeMode = 'cloud';
            activeModel = 'llama-4-scout-17b-16e-instruct-maas';
        }

        if (activeMode === 'local' && !isLocalModel) {
            activeModel = 'phi3:mini';
        }

        if (activeMode === 'local') {
            setMessages(prev => [...prev, { type: 'user', text }]);
            try {
                const response = await localAgent.process(text, messages, activeModel);
                setIsThinking(false);
                setMessages(prev => [...prev, { type: 'ai', text: response }]);
                speakNative(response);
            } catch (err) {
                console.error("Local AI Error:", err);
                setIsThinking(false);
                const errMsg = "Ollama is not reachable. Please ensure Ollama is running locally.";
                setMessages(prev => [...prev, { type: 'ai', text: errMsg }]);
                speakNative(errMsg);
            }
            return;
        }

        const payload = {
            type: 'text',
            content: text,
            user_id: session?.user?.id || 'anon',
            access_token: session?.access_token,
            voice_id: voice,
            voice_rate: voiceSpeed,
            model: activeModel,
            ai_mode: activeMode
        };

        if (attachment) {
            payload.attachment_type = attachment.type;
            payload.attachment_data = attachment.base64;
            payload.filename = attachment.file.name;
            setMessages(prev => [...prev, { type: 'user', text, image: attachment.type === 'image' ? attachment.previewUrl : null, attachmentName: attachment.file.name }]);
        } else {
            setMessages(prev => [...prev, { type: 'user', text }]);
        }

        wsRef.current.send(JSON.stringify(payload));
        setPendingAttachment(null);
    }, [voice, voiceSpeed, model, unlockAudio]);

    const startRecording = async () => {
        if (isRecordingRef.current) return;
        isRecordingRef.current = true;
        unlockAudio();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64 = reader.result.split(',')[1];
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        const { supabase } = await import('../lib/supabase');
                        const { data: { session } } = await supabase.auth.getSession();

                        const isOffline = !navigator.onLine;
                        const mobile = isMobile();
                        const pwa = isPWA();
                        const isLocalModel = model.includes(':');

                        let activeMode = (isOffline || isLocalModel) ? 'local' : 'cloud';
                        let activeModel = model;

                        if (!isOffline && (mobile || pwa) && !isLocalModel) {
                            activeMode = 'cloud';
                            activeModel = 'llama-4-scout-17b-16e-instruct-maas';
                        }

                        if (activeMode === 'local' && !isLocalModel) {
                            activeModel = 'phi3:mini';
                        }

                        const payload = {
                            type: 'voice',
                            content: base64,
                            user_id: session?.user?.id || 'anon',
                            access_token: session?.access_token,
                            voice_id: voice,
                            voice_rate: voiceSpeed,
                            model: activeModel,
                            ai_mode: activeMode
                        };

                        const attachment = pendingAttachmentRef.current;
                        if (attachment) {
                            payload.attachment_type = attachment.type;
                            payload.attachment_data = attachment.base64;
                            payload.filename = attachment.file.name;
                            setMessages(prev => [...prev, { type: 'user-audio', text: '🎤 ...', image: attachment.type === 'image' ? attachment.previewUrl : null, attachmentName: attachment.file.name }]);
                        } else {
                            setMessages(prev => [...prev, { type: 'user-audio', text: '🎤 ...' }]);
                        }
                        wsRef.current.send(JSON.stringify(payload));
                        setPendingAttachment(null);
                    }
                };
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error("Mic access error:", e);
            isRecordingRef.current = false;
            setIsListening(false);

            let errMsg = "Microphone access denied.";
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                errMsg = "Microphone requires a secure context (HTTPS). Please use HTTPS or access via localhost.";
            } else if (e.name === 'NotAllowedError') {
                errMsg = "Microphone permission blocked. Please enable it in browser settings.";
            } else if (e.name === 'NotFoundError') {
                errMsg = "No microphone detected on this device.";
            }

            setMessages(prev => [...prev, {
                type: 'ai',
                text: `❌ ${errMsg}`,
                isError: true
            }]);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecordingRef.current) {
            mediaRecorderRef.current.stop();
            isRecordingRef.current = false;
            setIsListening(false);
        }
    };

    return (
        <ChatContext.Provider value={{
            messages, sendMessage, startRecording, stopRecording,
            isListening, isThinking, setMessages, voice, changeVoice,
            isMuted, toggleMute, unlockAudio, isPlaying, isConnected,
            model, pendingAttachment, setPendingAttachment,
            sendImage: (file) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => setPendingAttachment({ file, type: 'image', base64: reader.result.split(',')[1], previewUrl: reader.result });
            },
            sendExcel: (file) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => setPendingAttachment({ file, type: 'excel', base64: reader.result.split(',')[1] });
            }
        }}>
            {children}
        </ChatContext.Provider>
    );
};
