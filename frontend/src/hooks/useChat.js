import { useState, useEffect, useRef, useCallback } from 'react';

export const useChat = () => {
    const [messages, setMessages] = useState([
        { type: 'ai', text: 'Namaste! Main Sathi AI hoon. Boliye main aapki kya madad kar sakta hoon?' }
    ]);
    const [isListening, setIsListening] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ws, setWs] = useState(null);
    const [voice, setVoice] = useState(localStorage.getItem('voice_id') || 'hi-IN-MadhurNeural');
    const [voiceSpeed, setVoiceSpeed] = useState(localStorage.getItem('voice_speed') || '+0%');
    const [model, setModel] = useState(localStorage.getItem('model_id') || 'gemini-2.0-flash-001');
    const [isMuted, setIsMuted] = useState(localStorage.getItem('isMuted') === 'true');
    const isMutedRef = useRef(localStorage.getItem('isMuted') === 'true');

    // Listen for settings changes from Settings.jsx
    useEffect(() => {
        const handleSettingsChange = () => {
            console.log("🔄 Detecting Settings Change...");
            setVoice(localStorage.getItem('voice_id') || 'hi-IN-MadhurNeural');
            setVoiceSpeed(localStorage.getItem('voice_speed') || '+0%');
            setModel(localStorage.getItem('model_id') || 'gemini-2.0-flash-001');
        };

        window.addEventListener('settings-changed', handleSettingsChange);
        // Also listen to storage events (cross-tab)
        window.addEventListener('storage', handleSettingsChange);

        return () => {
            window.removeEventListener('settings-changed', handleSettingsChange);
            window.removeEventListener('storage', handleSettingsChange);
        };
    }, []);

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

    useEffect(() => {
        const wsUrl = import.meta.env.VITE_BACKEND_WS_URL || 'ws://127.0.0.1:8000/ws/chat';
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

        socket.onopen = () => console.log('✅ Connected to Chat WS');

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'text') {
                    setIsThinking(false);

                    // Build message object with attachment if present
                    const aiMessage = {
                        type: 'ai',
                        text: data.content
                    };

                    // Preserve attachment/draft data from backend
                    if (data.attachment) {
                        aiMessage.attachment = data.attachment;
                    }

                    setMessages(prev => [...prev, aiMessage]);

                    // Play Audio if present, else fallback to Native TTS
                    if (data.audio) {
                        console.log("🔊 Received audio data, attempting playback...");
                        playAudio(data.audio);
                    } else {
                        console.log("⚠️ No server audio, falling back to Native TTS");
                        speakNative(data.content);
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

    // Helper: Browser Native TTS Fallback
    const speakNative = useCallback((text) => {
        if (isMutedRef.current || !text) return;

        // Cancel any current speaking
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Try to find a Hindi or Indian English voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.includes('hi-IN') || v.lang.includes('en-IN')) || voices[0];

        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = (e) => {
            console.error("Native TTS Error:", e);
            setIsPlaying(false);
        };

        window.speechSynthesis.speak(utterance);
    }, []);

    useEffect(() => {
        // Pre-load voices
        window.speechSynthesis.getVoices();
    }, []);
    // Helper: Play Base64 Audio with Blob/URL
    const playAudio = useCallback((base64Data) => {
        // Use Ref value to avoid stale closure trap
        if (isMutedRef.current) {
            console.log("🔇 Audio is muted (checked via Ref), skipping playback.");
            return;
        }

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

            audio.onplay = () => {
                console.log("✅ Audio playback started successfully");
                setIsPlaying(true);
            };
            audio.onended = () => setIsPlaying(false);
            audio.onerror = (e) => {
                console.error("❌ Audio Error:", e);
                setIsPlaying(false);
            };

            audio.play().catch(err => {
                console.warn("⚠️ Audio.play() blocked by browser. This usually requires a user click first.");
                console.error(err);
                setIsPlaying(false);
            });
        } catch (err) {
            console.error("❌ Error in playAudio helper:", err);
        }
    }, []);

    const sendMessage = useCallback(async (text) => {
        // Unlock audio context immediately on user action
        unlockAudio();

        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        setIsThinking(true);

        // Get current user ID
        const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
        const userId = session?.user?.id || 'anon';

        // DEBUG: Log voice settings being sent
        console.log(`📤 Sending message with voice settings: { voice_id: '${voice}', voice_rate: '${voiceSpeed}', model: '${model}' }`);

        ws.send(JSON.stringify({
            type: 'text',
            content: text,
            user_id: userId,
            access_token: session?.access_token, // Sending token too just in case
            voice_id: voice,
            voice_rate: voiceSpeed,
            model: navigator.onLine ? model : 'phi3:mini', // Fallback to phi3:mini if offline
            ai_mode: navigator.onLine ? 'cloud' : 'local'
        }));
        setMessages(prev => [...prev, { type: 'user', text }]);
    }, [ws, voice, voiceSpeed, model]);

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
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        // Get user ID async inside the callback
                        import('../lib/supabase').then(m => m.supabase.auth.getSession()).then(({ data: { session } }) => {
                            const userId = session?.user?.id || 'anon';

                            // DEBUG: Log voice settings for voice recording
                            console.log(`🎤 Sending voice recording with settings: { voice_id: '${voice}', voice_rate: '${voiceSpeed}', model: '${model}' }`);

                            ws.send(JSON.stringify({
                                type: 'voice',
                                content: base64,
                                user_id: userId,
                                access_token: session?.access_token,
                                voice_id: voice,
                                voice_rate: voiceSpeed,
                                model: navigator.onLine ? model : 'phi3:mini',
                                ai_mode: navigator.onLine ? 'cloud' : 'local'
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
        changeVoice,
        isMuted,
        toggleMute,
        unlockAudio,
        isPlaying,
        model
    };
};
