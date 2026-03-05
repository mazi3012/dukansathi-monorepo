import { useState, useEffect, useRef, useCallback } from 'react';

const getInitialMessages = () => {
    return [{ type: 'ai', text: 'Namaste Boss! Main aapka Dukan Sathi AI hoon. Store ka saara hisaar-kitaab mere paas hai. Aaj kya check karna hai?' }];
};

export const useChat = () => {
    const [messages, setMessages] = useState(getInitialMessages);

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

    // Listen for settings changes from Settings.jsx
    useEffect(() => {
        const handleSettingsChange = () => {
            console.log("🔄 Detecting Settings Change...");
            setVoice(localStorage.getItem('voice_id') || 'hi-IN-MadhurNeural');
            setVoiceSpeed(localStorage.getItem('voice_speed') || '+0%');
            setModel(localStorage.getItem('model_id') || 'llama-4-scout-17b-16e-instruct-maas');
        };

        window.addEventListener('settings-changed', handleSettingsChange);
        // Also listen to storage events (cross-tab)
        window.addEventListener('storage', handleSettingsChange);

        return () => {
            window.removeEventListener('settings-changed', handleSettingsChange);
            window.removeEventListener('storage', handleSettingsChange);
        };
    }, []);

    // Demo chat mode logic removed.

    // Function to toggle mute
    const toggleMute = () => {
        setIsMuted(prev => {
            const newState = !prev;
            localStorage.setItem('isMuted', newState);
            isMutedRef.current = newState; // Keep ref in sync for callbacks

            // Stop current audio if muting
            if (newState && lastAudioRef.current) {
                lastAudioRef.current.pause();
                if (lastAudioRef.current.src) URL.revokeObjectURL(lastAudioRef.current.src);
                lastAudioRef.current = null;
            }

            return newState;
        });
    };

    // Function to change voice (updates local state temporarily, Settings.jsx handles persistence)
    const changeVoice = (newVoice, newSpeed) => {
        setVoice(newVoice);
        if (newSpeed) {
            setVoiceSpeed(newSpeed);
        }
    };

    // Refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const lastAudioRef = useRef(null);
    const audioContextRef = useRef(null); // Ref for AudioContext to manage unlocking
    const isRecordingRef = useRef(false); // Guard to prevent double-start

    // Helper: Unlock Audio Context (Fix for Mobile Autoplay)
    const unlockAudio = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().then(() => {
                console.log("🔊 AudioContext Resumed/Unlocked");
            });
        }
    }, []);

    const wsRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    // Stable ref for message handler — avoids circular dependency between connectWebSocket & onMessageHandler
    const onMessageHandlerRef = useRef(null);

    const connectWebSocket = useCallback(() => {
        let wsUrl = import.meta.env.VITE_BACKEND_WS_URL;
        if (!wsUrl) {
            const apiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/chat';
        }
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;
        setWs(socket);

        socket.onopen = () => {
            console.log('✅ Connected to Chat WS');
            setIsConnected(true);
            reconnectAttemptRef.current = 0;
        };

        socket.onclose = (event) => {
            setIsConnected(false);
            if (!event.wasClean) {
                const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30000);
                console.warn(`⚠️ WS disconnected (code ${event.code}). Reconnecting in ${delay}ms...`);
                reconnectAttemptRef.current += 1;
                reconnectTimerRef.current = setTimeout(connectWebSocket, delay);
            }
        };

        socket.onerror = (e) => {
            console.error('[WS] Error:', e);
            setIsConnected(false);
        };

        // Use ref so the latest handler is always called, without re-creating this socket callback
        socket.onmessage = (event) => onMessageHandlerRef.current?.(event);

        return socket;
    }, []); // Empty deps — connectWebSocket is stable

    useEffect(() => {
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
                    const formattedHistory = history.map(msg => {
                        try {
                            // Try parsing message as JSON (for invoices)
                            const parsedData = JSON.parse(msg.message);
                            if (parsedData && parsedData.pdf_url) {
                                return {
                                    type: msg.role === 'assistant' ? 'ai' : 'user',
                                    text: parsedData.text || '',
                                    pdf_url: parsedData.pdf_url,
                                    customer_name: parsedData.customer_name,
                                    customer_phone: parsedData.customer_phone,
                                    grand_total: parsedData.grand_total,
                                    invoice_id: parsedData.invoice_id,
                                    items_summary: parsedData.items_summary
                                };
                            }
                        } catch (e) {
                            // Normal text message
                        }

                        return {
                            type: msg.role === 'assistant' ? 'ai' : 'user',
                            text: msg.message
                        };
                    });
                    setMessages(formattedHistory);
                } else {
                    setMessages([
                        { type: 'ai', text: 'Namaste! Main Sathi AI hoon. Boliye main aapki kya madad kar sakta hoon?' }
                    ]);
                }

                // Fetch User Settings (Voice & Speed)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('voice_id, voice_speed')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    if (profile.voice_id) {
                        setVoice(profile.voice_id);
                        localStorage.setItem('voice_id', profile.voice_id);
                    }
                    if (profile.voice_speed) {
                        setVoiceSpeed(profile.voice_speed);
                        localStorage.setItem('voice_speed', profile.voice_speed);
                    }
                }
            }
        };

        initChat();

        connectWebSocket();

        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) wsRef.current.close(1000, 'Component unmounted');
            if (lastAudioRef.current) {
                lastAudioRef.current.pause();
                if (lastAudioRef.current.src) URL.revokeObjectURL(lastAudioRef.current.src);
            }
        };
    }, [connectWebSocket]);

    // ── Helper: Browser Native TTS Fallback ─────────────────────────────────
    const speakNative = useCallback((text) => {
        if (isMutedRef.current || !text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('hi-IN') || v.lang.includes('en-IN')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = (e) => { console.error('Native TTS Error:', e); setIsPlaying(false); };
        window.speechSynthesis.speak(utterance);
    }, []);

    useEffect(() => { window.speechSynthesis.getVoices(); }, []);

    // ── Helper: Play Base64 Audio ─────────────────────────────────────────────
    const playAudio = useCallback((base64Data) => {
        if (isMutedRef.current) return;
        try {
            if (lastAudioRef.current) {
                lastAudioRef.current.pause();
                if (lastAudioRef.current.src) URL.revokeObjectURL(lastAudioRef.current.src);
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
            audio.onerror = (e) => { console.error('❌ Audio Error:', e); setIsPlaying(false); };
            audio.play().catch(err => {
                console.warn('⚠️ Audio blocked by browser (needs user gesture first)');
                setIsPlaying(false);
            });
        } catch (err) {
            console.error('❌ playAudio error:', err);
        }
    }, []);

    // ── WebSocket message handler ─────────────────────────────────────────────
    // Defined AFTER speakNative/playAudio so deps are available.
    // Uses onMessageHandlerRef so connectWebSocket never needs to be recreated.
    const onMessageHandler = useCallback((event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'text') {
                setIsThinking(false);
                const aiMessage = { type: 'ai', text: data.content };
                if (data.attachment) aiMessage.attachment = data.attachment;
                setMessages(prev => [...prev, aiMessage]);
                if (data.audio) {
                    playAudio(data.audio);
                } else {
                    speakNative(data.content);
                }
            } else if (data.type === 'image_pending') {
                // Backend stored the image; now prompt user to tell us what to do
                setIsThinking(false);
                setMessages(prev => [...prev, {
                    type: 'ai',
                    text: data.content,
                    image_url: data.image_url,
                    isImagePrompt: true   // special flag for UI
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
            } else if (data.type === 'error') {
                setIsThinking(false);
                console.error('[WS] Server error:', data.content);
            }
        } catch (e) {
            console.error('[WS] Parse Error:', e);
            setIsThinking(false);
        }
    }, [playAudio, speakNative]);

    // Keep ref in sync so reconnect sockets always use latest handler
    useEffect(() => { onMessageHandlerRef.current = onMessageHandler; }, [onMessageHandler]);


    const [pendingAttachment, setPendingAttachment] = useState(null); // { file, type, base64, previewUrl }
    const pendingAttachmentRef = useRef(null); // Mirrors pendingAttachment for use in callbacks

    // Keep ref in sync with state
    useEffect(() => { pendingAttachmentRef.current = pendingAttachment; }, [pendingAttachment]);


    const sendMessage = useCallback(async (text, attachment = null) => {
        // Unlock audio context immediately on user action
        unlockAudio();

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn("⚠️ WebSocket not connected. Waiting for connection...");
            // We no longer append the network issue pseudo-message automatically.
            // UI will disable sending while !isConnected. 
            // If the user somehow triggers it, we just return safely without spamming.
            return;
        }
        setIsThinking(true);

        // Get current user ID
        const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
        const userId = session?.user?.id || 'anon';

        // DEBUG: Log voice settings being sent
        console.log(`📤 Sending message with voice settings: { voice_id: '${voice}', voice_rate: '${voiceSpeed}', model: '${model}' }`);

        const activeModel = (!navigator.onLine || localStorage.getItem('auto_sync_enabled') === 'false') ? 'phi3:mini' : model;
        const activeMode = (!navigator.onLine || localStorage.getItem('auto_sync_enabled') === 'false') ? 'local' : 'cloud';

        const payload = {
            type: 'text',
            content: text,
            user_id: userId,
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

        ws.send(JSON.stringify(payload));
        setPendingAttachment(null); // Clear pending attachment
    }, [ws, voice, voiceSpeed, model]);

    const sendImage = useCallback((file) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setPendingAttachment({
                file,
                type: 'image',
                base64,
                previewUrl: reader.result
            });
        };
    }, []);

    const sendExcel = useCallback((file) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setPendingAttachment({
                file,
                type: 'excel',
                base64
            });
        };
    }, []);

    // Simplified Audio Recording Logic
    const startRecording = async () => {
        // Guard: prevent double-start if already recording
        if (isRecordingRef.current) {
            console.warn('⚠️ startRecording called while already recording — ignoring.');
            return;
        }
        isRecordingRef.current = true;

        // Unlock audio context immediately
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
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        // Get user ID async inside the callback
                        import('../lib/supabase').then(m => m.supabase.auth.getSession()).then(({ data: { session } }) => {
                            const userId = session?.user?.id || 'anon';

                            // DEBUG: Log voice settings for voice recording
                            console.log(`🎤 Sending voice recording with settings: { voice_id: '${voice}', voice_rate: '${voiceSpeed}', model: '${model}' }`);

                            const activeModel = (!navigator.onLine || localStorage.getItem('auto_sync_enabled') === 'false') ? 'phi3:mini' : model;
                            const activeMode = (!navigator.onLine || localStorage.getItem('auto_sync_enabled') === 'false') ? 'local' : 'cloud';

                            const payload = {
                                type: 'voice',
                                content: base64,
                                user_id: userId,
                                access_token: session?.access_token,
                                voice_id: voice,
                                voice_rate: voiceSpeed,
                                model: activeModel,
                                ai_mode: activeMode
                            };

                            // Read the current pending attachment via ref (NOT inside a state updater)
                            // so that side-effects (WS send, setMessages) are never called twice.
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
                            setPendingAttachment(null); // Clear pending attachment
                        });
                    }
                };
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
        } catch (e) {
            console.error("Mic Error", e);
            isRecordingRef.current = false; // Reset guard on failure
            alert("Mic Access Denied");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecordingRef.current) {
            mediaRecorderRef.current.stop();
            isRecordingRef.current = false;
            setIsListening(false);
        }
    };

    return {
        messages,
        sendMessage,
        sendImage,
        sendExcel,
        startRecording,
        stopRecording,
        isListening,
        isThinking,
        setMessages,
        voice,
        changeVoice,
        isMuted,
        toggleMute,
        unlockAudio,
        isPlaying,
        isConnected,
        model,
        pendingAttachment,
        setPendingAttachment
    };
};
