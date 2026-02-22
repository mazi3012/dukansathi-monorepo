import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Check, User, Save, Loader2, Play, Brain, Gauge, Cpu, Download, RefreshCw, AlertCircle, Send, Link, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const VOICE_OPTIONS = [
    {
        language: 'Hindi (India)',
        voices: [
            { id: 'hi-IN-MadhurNeural', label: 'Madhur (Male)', gender: 'Male' },
            { id: 'hi-IN-SwaraNeural', label: 'Swara (Female)', gender: 'Female' }
        ]
    },
    {
        language: 'English (India)',
        voices: [
            { id: 'en-IN-PrabhatNeural', label: 'Prabhat (Male)', gender: 'Male' },
            { id: 'en-IN-NeerjaNeural', label: 'Neerja (Female)', gender: 'Female' }
        ]
    },


];

const MODEL_OPTIONS = [
    { id: 'gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (Fastest)', description: 'Best for quick chats and simple actions.' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Smarter)', description: 'Better reasoning for complex business queries.' },
    { id: 'phi3:mini', label: 'Phi-3 Mini (Local)', description: 'Runs offline on your computer. Requires Ollama.' },
    { id: 'gemma:2b', label: 'Gemma 2B (Local)', description: 'Lightweight Google model for low-spec PCs.' }
];

const Settings = () => {
    const navigate = useNavigate();
    const [selectedVoice, setSelectedVoice] = useState('en-IN-PrabhatNeural');
    const [voiceSpeed, setVoiceSpeed] = useState(0); // 0 means +0%, range -50 to +50
    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash-001');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const [playingVoice, setPlayingVoice] = useState(null); // ID of currently playing preview

    // Local AI States
    const [hardware, setHardware] = useState(null);
    const [localModels, setLocalModels] = useState([]);
    const [isInstalling, setIsInstalling] = useState(null);
    const [ollamaStatus, setOllamaStatus] = useState('checking');

    // Telegram Connect States
    const [telegramCode, setTelegramCode] = useState(null);       // Generated OTP code
    const [telegramCodeExpiry, setTelegramCodeExpiry] = useState(null); // seconds remaining
    const [telegramConnected, setTelegramConnected] = useState(false);  // Already linked
    const [generatingCode, setGeneratingCode] = useState(false);
    const timerRef = useRef(null);

    const API_BASE = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
    const BOT_USERNAME = 'SathiAibot';

    // Load Settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                // 1. Load from LocalStorage (Fast)
                const localVoice = localStorage.getItem('voice_id');
                const localSpeed = localStorage.getItem('voice_speed');
                const localModel = localStorage.getItem('model_id');

                if (localVoice) setSelectedVoice(localVoice);
                if (localModel) setSelectedModel(localModel);
                if (localSpeed) {
                    const speed = parseInt(localSpeed.replace('%', ''));
                    if (!isNaN(speed)) setVoiceSpeed(speed);
                }

                // 2. Load from Supabase (Sync)
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setLoading(false);
                } else {
                    setUser(session.user);
                    const { data } = await supabase
                        .from('profiles')
                        .select('voice_id, voice_speed, model_id')
                        .eq('id', session.user.id)
                        .single();

                    if (data) {
                        if (data.voice_id) {
                            setSelectedVoice(data.voice_id);
                            localStorage.setItem('voice_id', data.voice_id);
                        }
                        if (data.model_id) {
                            setSelectedModel(data.model_id);
                            localStorage.setItem('model_id', data.model_id);
                        }
                        if (data.voice_speed) {
                            const speed = parseInt(data.voice_speed.replace('%', ''));
                            if (!isNaN(speed)) {
                                setVoiceSpeed(speed);
                                localStorage.setItem('voice_speed', data.voice_speed);
                            }
                        }
                    }
                }

                // 3. Load Hardware & Local AI Status
                fetchHardware();
                fetchLocalModels();

            } catch (err) {
                console.error("Error loading settings:", err);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, []);

    // Check if Telegram is already connected for this user
    useEffect(() => {
        const checkTelegramConnection = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const { data } = await supabase
                    .from('telegram_users')
                    .select('user_id')
                    .eq('user_id', session.user.id)
                    .limit(1)
                    .single();
                if (data) setTelegramConnected(true);
            } catch {
                // Not connected — ignore
            }
        };
        checkTelegramConnection();
    }, []);

    // Countdown timer for OTP code
    useEffect(() => {
        if (telegramCodeExpiry === null) return;
        if (telegramCodeExpiry <= 0) { setTelegramCode(null); setTelegramCodeExpiry(null); return; }
        timerRef.current = setTimeout(() => setTelegramCodeExpiry(e => e - 1), 1000);
        return () => clearTimeout(timerRef.current);
    }, [telegramCodeExpiry]);

    const generateTelegramCode = async () => {
        setGeneratingCode(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(`${API_BASE}/api/telegram/generate-token`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setTelegramCode(data.token);
            setTelegramCodeExpiry(data.expires_in_seconds);
        } catch (e) {
            console.error('Failed to generate telegram code:', e);
        } finally {
            setGeneratingCode(false);
        }
    };


    const fetchHardware = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/setup/hardware`);
            if (res.ok) {
                const data = await res.json();
                setHardware(data);
            }
        } catch (e) {
            console.error("Hardware fetch failed:", e);
        }
    };

    const fetchLocalModels = async () => {
        try {
            // First check if Ollama is even alive
            const checkRes = await fetch(`${API_BASE}/api/setup/ollama-check`);
            const checkData = await checkRes.json();

            if (checkData.is_running) {
                setOllamaStatus('connected');
                const res = await fetch(`${API_BASE}/api/setup/local-models`);
                if (res.ok) {
                    const data = await res.json();
                    setLocalModels(data.models || []);
                }
            } else {
                setOllamaStatus('offline');
                setLocalModels([]);
            }
        } catch (e) {
            console.error("Local models fetch failed:", e);
            setOllamaStatus('offline');
        }
    };

    const installModel = async (modelName) => {
        setIsInstalling(modelName);
        try {
            const res = await fetch(`${API_BASE}/api/setup/install-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_name: modelName })
            });

            if (res.ok) {
                alert(`Started installing ${modelName}. This will take a few minutes in the background.`);
                // Poll for completion every 10 seconds
                const interval = setInterval(async () => {
                    const checkRes = await fetch(`${API_BASE}/api/setup/local-models`);
                    const checkData = await checkRes.json();
                    const isDone = checkData.models?.some(m => m.name.includes(modelName));
                    if (isDone) {
                        setLocalModels(checkData.models);
                        setIsInstalling(null);
                        clearInterval(interval);
                    }
                }, 10000);
            } else {
                const err = await res.json();
                alert(err.detail || "Installation failed");
                setIsInstalling(null);
            }
        } catch (e) {
            alert("Connection error to backend");
            setIsInstalling(null);
        }
    };

    const [hasChanges, setHasChanges] = useState(false);
    const markChange = () => setHasChanges(true);

    const saveSettings = async () => {
        setSaving(true);
        try {
            const speedStr = (voiceSpeed >= 0 ? '+' : '') + voiceSpeed + '%';

            localStorage.setItem('voice_id', selectedVoice);
            localStorage.setItem('voice_speed', speedStr);
            localStorage.setItem('model_id', selectedModel);

            window.dispatchEvent(new Event('settings-changed'));
            window.dispatchEvent(new Event('storage'));

            if (user) {
                const { error } = await supabase
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        voice_id: selectedVoice,
                        voice_speed: speedStr,
                        model_id: selectedModel,
                        updated_at: new Date().toISOString()
                    });

                if (error) console.warn("Cloud save warning:", error.message);
            }

            setHasChanges(false);
            alert("Settings saved successfully!");

        } catch (err) {
            console.error("Error saving settings:", err);
            alert("Failed to save settings to cloud (Local save worked)");
        } finally {
            setSaving(false);
        }
    };

    const previewVoice = async (voiceId) => {
        if (playingVoice) return;
        setPlayingVoice(voiceId);
        const text = voiceId.includes('hi') ? "Namaste! Main Sathi AI hoon." : "Hello! I am Sathi AI.";
        try {
            const response = await fetch(`${API_BASE}/api/tts-preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voice_id: voiceId,
                    rate: (voiceSpeed >= 0 ? '+' : '') + voiceSpeed + '%'
                })
            });
            if (!response.ok) throw new Error("Preview failed");
            const data = await response.json();
            const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
            audio.onended = () => setPlayingVoice(null);
            audio.onerror = () => setPlayingVoice(null);
            await audio.play();
        } catch (error) {
            console.error("Preview Error:", error);
            setPlayingVoice(null);
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="bg-white p-4 border-b border-slate-100 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                        <User size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
                        <p className="text-xs text-slate-500">Preferences & Configuration</p>
                    </div>
                </div>

                <button
                    onClick={saveSettings}
                    disabled={saving || !hasChanges}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full font-medium transition-all ${hasChanges
                        ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transform hover:-translate-y-0.5'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24">

                {/* Local AI Status & Hardware */}
                <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Cpu size={24} />
                                <h2 className="font-bold text-lg">Local AI & Offline Mode</h2>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${ollamaStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                                {ollamaStatus === 'connected' ? 'Ollama Online' : 'Ollama Offline'}
                            </div>
                        </div>

                        {hardware && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-indigo-200 uppercase font-bold mb-1">Processor</div>
                                    <div className="text-sm font-semibold truncate" title={hardware.cpu}>{hardware.cpu}</div>
                                </div>
                                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-indigo-200 uppercase font-bold mb-1">Memory</div>
                                    <div className="text-sm font-semibold">{hardware.ram_total_gb} GB RAM</div>
                                </div>
                                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                                    <div className="text-[10px] text-indigo-200 uppercase font-bold mb-1">Graphics (VRAM)</div>
                                    <div className="text-sm font-semibold truncate">{hardware.gpu} ({hardware.vram_gb} GB)</div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <button
                                onClick={() => navigate('/setup')}
                                className="w-full sm:w-auto px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                Run System Wizard
                            </button>
                            <button
                                onClick={fetchLocalModels}
                                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-500/30 text-white border border-white/20 rounded-xl font-bold text-sm hover:bg-indigo-500/40 transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Refresh Status
                            </button>
                        </div>
                    </div>

                    {/* Decorative background circle */}
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                </section>

                {/* AI Model Selection */}
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Brain className="text-indigo-600" size={20} />
                        <h2 className="font-semibold text-slate-800">Choose AI Brain</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {MODEL_OPTIONS.map((opt) => {
                            const isLocal = opt.id.includes(':') || opt.id.includes('phi') || opt.id.includes('gemma');
                            const isDownloaded = localModels.some(m => m.name.includes(opt.id.split(':')[0]));

                            return (
                                <div key={opt.id} className="relative">
                                    <button
                                        onClick={() => { setSelectedModel(opt.id); markChange(); }}
                                        className={`w-full p-4 rounded-xl border text-left transition-all h-full ${selectedModel === opt.id
                                            ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600'
                                            : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="font-semibold text-slate-800">{opt.label}</div>
                                            {isLocal && (
                                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${isDownloaded ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    {isDownloaded ? 'Local Ready' : 'External'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 leading-relaxed pr-8">{opt.description}</div>

                                        {selectedModel === opt.id &&
                                            <div className="absolute top-4 right-4 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                                                <Check size={12} className="text-white" />
                                            </div>
                                        }
                                    </button>

                                    {isLocal && !isDownloaded && (
                                        <button
                                            onClick={() => installModel(opt.id)}
                                            disabled={isInstalling !== null || ollamaStatus !== 'connected'}
                                            className="absolute bottom-4 right-4 p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-30"
                                            title="Download Model"
                                        >
                                            {isInstalling === opt.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {ollamaStatus === 'offline' && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-700">
                                <p className="font-bold mb-1">Ollama is not running!</p>
                                <p>To use local models, please install Ollama from <a href="https://ollama.com" className="underline font-bold" target="_blank" rel="noreferrer">ollama.com</a> and make sure it's running on your system.</p>
                            </div>
                        </div>
                    )}
                </section>

                {/* Voice Selection */}
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Volume2 className="text-indigo-600" size={20} />
                        <h2 className="font-semibold text-slate-800">Voice Assistant</h2>
                    </div>

                    <div className="space-y-6">
                        {VOICE_OPTIONS.map((group) => (
                            <div key={group.language}>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">{group.language}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {group.voices.map((voice) => (
                                        <div
                                            key={voice.id}
                                            className={`relative flex items-center p-3 rounded-xl border transition-all ${selectedVoice === voice.id
                                                ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600'
                                                : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div
                                                className="flex-1 flex items-center cursor-pointer"
                                                onClick={() => { setSelectedVoice(voice.id); markChange(); }}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${selectedVoice === voice.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <div className={`font-medium text-sm ${selectedVoice === voice.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                        {voice.label}
                                                    </div>
                                                    <div className="text-xs opacity-60 text-slate-500">{voice.gender}</div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); previewVoice(voice.id); }}
                                                disabled={playingVoice !== null}
                                                className={`p-2 rounded-full hover:bg-white hover:shadow-sm transition-all ml-2 ${playingVoice === voice.id ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`}
                                            >
                                                {playingVoice === voice.id ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Speed Control */}
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Gauge className="text-indigo-600" size={20} />
                            <h2 className="font-semibold text-slate-800">Speaking Speed</h2>
                        </div>
                        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                            {voiceSpeed > 0 ? '+' : ''}{voiceSpeed}%
                        </span>
                    </div>

                    <div className="px-2">
                        <input
                            type="range"
                            min="-50"
                            max="50"
                            step="5"
                            value={voiceSpeed}
                            onChange={(e) => { setVoiceSpeed(parseInt(e.target.value)); markChange(); }}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                            <span>Slower (-50%)</span>
                            <span>Normal (0%)</span>
                            <span>Faster (+50%)</span>
                        </div>
                    </div>
                </section>

                {/* ── Telegram Connect Section ─────────── */}
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 overflow-hidden relative">
                    {/* Sky blue accent strip */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500" />

                    <div className="flex items-center gap-2 mb-1 mt-1">
                        <Send className="text-sky-500" size={20} />
                        <h2 className="font-semibold text-slate-800">Connect Telegram</h2>
                        {telegramConnected && (
                            <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={12} /> Connected
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mb-5">
                        Chat with Sathi AI, add products, and create invoices right from Telegram.
                    </p>

                    {telegramConnected ? (
                        /* Already connected */
                        <div className="flex flex-col items-center gap-3 py-2">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 className="text-emerald-500" size={28} />
                            </div>
                            <p className="text-sm font-medium text-slate-700">Your account is linked to Telegram!</p>
                            <a
                                href={`https://t.me/${BOT_USERNAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                            >
                                <Send size={16} /> Open @{BOT_USERNAME}
                            </a>
                        </div>
                    ) : telegramCode ? (
                        /* Code generated — show it */
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-sm text-slate-600 text-center">Send this code to the bot:</p>

                            {/* Bot link */}
                            <a
                                href={`https://t.me/${BOT_USERNAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-600 text-sm font-semibold underline underline-offset-2"
                            >
                                👉 Open @{BOT_USERNAME} on Telegram
                            </a>

                            {/* Step-by-step */}
                            <div className="w-full bg-sky-50 rounded-xl p-4 text-sm text-slate-700 space-y-1.5">
                                <p>1️⃣ Open the bot link above</p>
                                <p>2️⃣ Type the command below and send it:</p>
                                <div
                                    onClick={() => { navigator.clipboard?.writeText(`/connect ${telegramCode}`); }}
                                    className="cursor-pointer bg-white border border-sky-200 rounded-lg p-3 mt-1 text-center"
                                >
                                    <code className="text-blue-700 font-bold text-lg tracking-widest">/connect {telegramCode}</code>
                                    <p className="text-[10px] text-slate-400 mt-1">Tap to copy</p>
                                </div>
                            </div>

                            {/* Expiry */}
                            <p className="text-xs text-slate-400">
                                🕐 Code expires in {Math.floor(telegramCodeExpiry / 60)}:{String(telegramCodeExpiry % 60).padStart(2, '0')} min
                            </p>

                            <button
                                onClick={generateTelegramCode}
                                disabled={generatingCode}
                                className="text-xs text-slate-400 underline hover:text-slate-600"
                            >
                                Generate new code
                            </button>
                        </div>
                    ) : (
                        /* Initial state */
                        <div className="flex flex-col items-center gap-4 py-2">
                            {/* 3-step visual */}
                            <div className="w-full grid grid-cols-3 gap-2 text-center text-xs text-slate-500 mb-1">
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-sm">1</div>
                                    <span>Tap Generate</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-sm">2</div>
                                    <span>Open Telegram Bot</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-sm">3</div>
                                    <span>Send the code</span>
                                </div>
                            </div>

                            <button
                                onClick={generateTelegramCode}
                                disabled={generatingCode}
                                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm text-sm w-full justify-center"
                            >
                                {generatingCode
                                    ? <><Loader2 size={16} className="animate-spin" /> Generating...</>
                                    : <><Send size={16} /> Generate My Code</>}
                            </button>
                        </div>
                    )}
                </section>

                <div className="text-center text-xs text-slate-400 py-6">
                    <p>Dukan Sathi v1.1 • Powered by Moltbot AI</p>
                    <p>Local AI powered by Ollama</p>
                </div>
            </div>
        </div>
    );
};

export default Settings;
