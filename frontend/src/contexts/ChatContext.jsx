import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
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
    const [aiLanguage, setAiLanguage] = useState(localStorage.getItem('ai_language') || 'hinglish');

    const model = 'gemini-3.1-flash-lite-preview';
    const [isMuted, setIsMuted] = useState(localStorage.getItem('isMuted') === 'true');
    const isMutedRef = useRef(localStorage.getItem('isMuted') === 'true');

    const [pendingAttachment, setPendingAttachment] = useState(null);
    const pendingAttachmentRef = useRef(null);

    // Permission State
    const [micPermission, setMicPermission] = useState('prompt'); 
    const [camPermission, setCamPermission] = useState('prompt');
    const [isSecure, setIsSecure] = useState(true);
    const [hasExplicitlyDenied, setHasExplicitlyDenied] = useState(false);

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
    const isMountedRef = useRef(false); // Tracks real mount vs StrictMode double-invoke

    useEffect(() => {
        pendingAttachmentRef.current = pendingAttachment;
    }, [pendingAttachment]);

    // Handle Settings Change
    useEffect(() => {
        const handleSettingsChange = () => {
            setVoice(localStorage.getItem('voice_id') || 'hi-IN-MadhurNeural');
            setVoiceSpeed(localStorage.getItem('voice_speed') || '+0%');
            setAiLanguage(localStorage.getItem('ai_language') || 'hinglish');
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
        // Force speech synthesis to "warm up"
        if (window.speechSynthesis) {
             window.speechSynthesis.getVoices();
        }
    }, []);

    const checkPermissions = useCallback(async () => {
        // 1. Basic Secure Context Check
        const isCurrentlySecure = window.isSecureContext || 
            window.location.protocol === 'https:' || 
            window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1';
        setIsSecure(isCurrentlySecure);

        if (!navigator.permissions || !navigator.permissions.query) return;

        try {
            const mic = await navigator.permissions.query({ name: 'microphone' });
            setMicPermission(mic.state);
            mic.onchange = () => setMicPermission(mic.state);

            // Some browsers don't support 'camera' in query
            try {
                const cam = await navigator.permissions.query({ name: 'camera' });
                setCamPermission(cam.state);
                cam.onchange = () => setCamPermission(cam.state);
            } catch (e) { /* ignore camera query if not supported */ }

        } catch (e) {
            console.warn("Permissions API query failed:", e);
            // On browsers where query fails (like Safari), we stay in 'prompt' until request is made
            if (micPermission === 'denied' && !hasExplicitlyDenied) {
                 // Try to recover if we think we might have permission but don't know
            }
        }
    }, [micPermission, hasExplicitlyDenied]);

    const requestMicPermission = useCallback(async () => {
        unlockAudio();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("Browser does not support MediaDevices/getUserMedia");
            setMicPermission('denied');
            setHasExplicitlyDenied(true);
            return false;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setMicPermission('granted');
            setHasExplicitlyDenied(false); // Reset error state on success
            return true;
        } catch (e) {
            console.error("Mic request failed:", e);
            // Handle all variations of denial
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || e.name === 'SecurityError') {
                setMicPermission('denied');
                setHasExplicitlyDenied(true); // Flag that user actually clicked "Block"
            } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                // No mic found - alert or handle separately
                console.warn("No device found");
            }
            return false;
        }
    }, [unlockAudio]);

    const requestCamPermission = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            setCamPermission('granted');
            return true;
        } catch (e) {
            console.error("Cam request failed:", e);
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                setCamPermission('denied');
            }
            return false;
        }
    }, []);

    useEffect(() => {
        checkPermissions();
        // Fallback polling for browsers where onchange is unreliable
        const interval = setInterval(checkPermissions, 3000);
        return () => clearInterval(interval);
    }, [checkPermissions]);

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

                // Parse AI messages that are JSON (Invoices, Reports, etc.)
                let noTts = data.no_tts || false;
                try {
                    const parsed = JSON.parse(data.content);
                    
                    // Handle Invoice PDF data
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

                    // Handle Report Drafts
                    if (parsed.type === 'report_draft') {
                        aiMessage.attachment = parsed;
                        aiMessage.text = parsed.summary || data.content; // Use summary as text
                        if (parsed.no_tts) noTts = true;
                    }
                } catch (e) { }

                setMessages(prev => [...prev, aiMessage]);
                
                if (!noTts) {
                    if (data.audio) playAudio(data.audio);
                    else speakNative(aiMessage.text || data.content);
                }

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
        // Don't create a duplicate if already open or connecting
        if (wsRef.current?.readyState === WebSocket.OPEN) return;
        if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

        let wsUrl = import.meta.env.VITE_BACKEND_WS_URL;
        if (!wsUrl) {
            const currentHost = window.location.hostname;
            const apiUrl = import.meta.env.VITE_BACKEND_API_URL || `http://${currentHost}:8000`;
            wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/chat';
        }

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;
        setWs(socket);

        socket.onopen = () => {
            // Only update state if this is still the active socket
            if (wsRef.current !== socket) return;
            setIsConnected(true);
            reconnectAttemptRef.current = 0;
        };

        socket.onclose = (event) => {
            if (wsRef.current !== socket) return; // stale socket, ignore
            setIsConnected(false);
            if (!isMountedRef.current) return; // unmounted, don't reconnect
            if (reconnectAttemptRef.current > 10) {
                console.warn('Max WebSocket reconnect attempts reached. Giving up.');
                return;
            }
            const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 15000);
            reconnectAttemptRef.current += 1;
            reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
        };

        socket.onerror = () => {
            // Suppress — errors always precede an onclose which handles reconnect
        };

        socket.onmessage = (event) => onMessageHandlerRef.current?.(event);
    }, []);;

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

        isMountedRef.current = true;
        initChat();
        connectWebSocket();

        return () => {
            isMountedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            const ws = wsRef.current;
            if (!ws) return;
            if (ws.readyState === WebSocket.OPEN) {
                // Cleanly close an open socket
                ws.close();
            } else if (ws.readyState === WebSocket.CONNECTING) {
                // CONNECTING: don't close (causes browser error). Detach handlers so
                // when it connects it does nothing, then let it die on its own.
                ws.onopen = null;
                ws.onclose = null;
                ws.onerror = null;
                ws.onmessage = null;
                wsRef.current = null; // The next mount will create a fresh socket
            }
        };
    }, [connectWebSocket]);

    const sendMessage = useCallback(async (text, attachment = null) => {
        unlockAudio();
        // Force establish connection if it was dropped
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            connectWebSocket();
            // Wait briefly for connection (in production, a robust message queue would be better)
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                 setMessages(prev => [...prev, { type: 'ai', text: 'Still reconnecting... Please try again in a moment.', isError: true }]);
                 return;
            }
        }

        setIsThinking(true);
        const { supabase } = await import('../lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();

        const payload = {
            type: 'text',
            content: text,
            user_id: session?.user?.id || 'anon',
            access_token: session?.access_token,
            voice_id: voice,
            voice_rate: voiceSpeed,
            model: model,
            language: aiLanguage,
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
    }, [voice, voiceSpeed, model, aiLanguage, unlockAudio]);

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

                        const payload = {
                            type: 'voice',
                            content: base64,
                            user_id: session?.user?.id || 'anon',
                            access_token: session?.access_token,
                            voice_id: voice,
                            voice_rate: voiceSpeed,
                            model: model,
                            language: aiLanguage,
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
            const isSecureContext = window.isSecureContext || (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            if (!isSecureContext) {
                errMsg = "Microphone requires a secure context (HTTPS). Please use HTTPS or access via localhost/127.0.0.1.";
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
            micPermission, camPermission, isSecure, hasExplicitlyDenied, checkPermissions, 
            requestMicPermission, requestCamPermission,
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
