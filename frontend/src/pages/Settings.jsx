import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Check, User, Save, Loader2, Play, Brain, Gauge, Cpu, Download, RefreshCw, AlertCircle, QrCode, Moon, Sun, ChevronRight } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
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
    { id: 'phi3:mini', label: 'Phi-3 Mini (Local)', description: 'Runs offline on your computer. Requires Ollama.' },
    { id: 'gemma:2b', label: 'Gemma 2B (Local)', description: 'Lightweight Google model for low-spec PCs.' }
];

const Settings = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('ai'); // 'ai' | 'voice' | 'branding' | 'system'
    const [selectedVoice, setSelectedVoice] = useState('en-IN-PrabhatNeural');
    const [voiceSpeed, setVoiceSpeed] = useState(0);
    const [selectedModel, setSelectedModel] = useState('llama-4-scout-17b-16e-instruct-maas');
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const [playingVoice, setPlayingVoice] = useState(null); // ID of currently playing preview

    // Local AI States
    const [hardware, setHardware] = useState(null);
    const [localModels, setLocalModels] = useState([]);
    const [isInstalling, setIsInstalling] = useState(null);
    const [ollamaStatus, setOllamaStatus] = useState('checking');

    let rawApiBase = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
    const API_BASE = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;

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


    const getAuthHeaders = async (additionalHeaders = {}) => {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { ...additionalHeaders };
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        return headers;
    };

    const fetchHardware = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/api/setup/hardware`, { headers });
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
            const headers = await getAuthHeaders();
            // First check if Ollama is even alive
            const checkRes = await fetch(`${API_BASE}/api/setup/ollama-check`, { headers });
            const checkData = await checkRes.json();

            if (checkData.is_running) {
                setOllamaStatus('connected');
                const res = await fetch(`${API_BASE}/api/setup/local-models`, { headers });
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
            const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
            const res = await fetch(`${API_BASE}/api/setup/install-ai`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ model_name: modelName })
            });

            if (res.ok) {
                alert(`Started installing ${modelName}. This will take a few minutes in the background.`);
                // Poll for completion every 10 seconds
                const interval = setInterval(async () => {
                    const checkHeaders = await getAuthHeaders();
                    const checkRes = await fetch(`${API_BASE}/api/setup/local-models`, { headers: checkHeaders });
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
            const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
            const response = await fetch(`${API_BASE}/api/tts-preview`, {
                method: 'POST',
                headers,
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

    const downloadQRCode = () => {
        const canvas = document.getElementById("qr-gen");
        if (!canvas) return;
        const pngUrl = canvas
            .toDataURL("image/png")
            .replace("image/png", "image/octet-stream");
        let downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `DukanSathi_Store_${user?.id || 'QR'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    const TabButton = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${activeTab === id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                : 'text-text-muted border-transparent hover:bg-card-bg hover:text-text-main'
                }`}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden relative">
            <header className="flex flex-col md:flex-row md:items-end justify-between px-6 pt-6 gap-6 relative z-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[22px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform hover:scale-110">
                        <Settings size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Control Center</h1>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mt-1 transition-colors">Protocol & System Orchestration</p>
                    </div>
                </div>

                <button
                    onClick={saveSettings}
                    disabled={saving || !hasChanges}
                    className={`flex items-center gap-4 px-10 py-4 rounded-2xl font-black transition-all tracking-[0.2em] text-[10px] uppercase shadow-2xl ${hasChanges
                        ? 'bg-indigo-600 text-white shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-card-bg/50 text-text-muted border border-card-border/50 cursor-not-allowed opacity-50'
                        }`}
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />}
                    {saving ? 'Syncing...' : 'Commit Changes'}
                </button>
            </header>

            <div className="flex items-center gap-3 px-6 py-4 overflow-x-auto whitespace-nowrap scrollbar-hide z-10">
                <TabButton id="ai" icon={Brain} label="Intelligence" />
                <TabButton id="voice" icon={Volume2} label="Neural Voice" />
                <TabButton id="branding" icon={QrCode} label="Identity" />
                <TabButton id="system" icon={Cpu} label="Core System" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 relative z-0">

                {activeTab === 'system' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* System Protocol & Hardware */}
                        <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 text-white shadow-xl overflow-hidden relative">
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Cpu size={24} />
                                        <h2 className="font-bold text-lg">System Hardware</h2>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${ollamaStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                        <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                                        {ollamaStatus === 'connected' ? 'Ollama Online' : 'Ollama Offline'}
                                    </div>
                                </div>

                                {hardware && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                                            <div className="text-[10px] text-indigo-200 uppercase font-black mb-1">Processor</div>
                                            <div className="text-sm font-bold truncate" title={hardware.cpu}>{hardware.cpu}</div>
                                        </div>
                                        <div className="bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                                            <div className="text-[10px] text-indigo-200 uppercase font-black mb-1">Memory</div>
                                            <div className="text-sm font-bold">{hardware.ram_total_gb} GB RAM</div>
                                        </div>
                                        <div className="bg-white/10 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
                                            <div className="text-[10px] text-indigo-200 uppercase font-black mb-1">Graphics</div>
                                            <div className="text-sm font-bold truncate">{hardware.gpu}</div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <button
                                        onClick={() => navigate('/setup')}
                                        className="w-full sm:w-auto px-6 py-2.5 bg-white text-indigo-600 rounded-xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg"
                                    >
                                        Run System Wizard
                                    </button>
                                    <button
                                        onClick={fetchLocalModels}
                                        className="w-full sm:w-auto px-6 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-black text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={16} />
                                        Refresh Status
                                    </button>
                                </div>
                            </div>
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                        </section>

                        {/* Theme Protocol */}
                        <section className="glass-card rounded-3xl p-6 border-indigo-500/10 bg-indigo-500/[0.01]">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform group-hover:scale-110">
                                        {theme === 'light' ? <Moon size={28} /> : <Sun size={28} />}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black font-heading text-text-main transition-colors tracking-tight">Interface Protocol</h2>
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] transition-colors mt-1">Light / Dark Mode Selection</p>
                                    </div>
                                </div>
                                <div className="bg-card-bg/50 p-1.5 rounded-2xl border border-card-border/50 flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => {
                                            setTheme('light');
                                            localStorage.setItem('theme', 'light');
                                            document.documentElement.setAttribute('data-theme', 'light');
                                            window.dispatchEvent(new Event('theme-changed'));
                                        }}
                                        className={`flex-1 sm:flex-none px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 justify-center ${theme === 'light' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-text-muted hover:text-text-main hover:bg-card-bg'}`}
                                    >
                                        <Sun size={14} />
                                        Light
                                    </button>
                                    <button
                                        onClick={() => {
                                            setTheme('dark');
                                            localStorage.setItem('theme', 'dark');
                                            document.documentElement.setAttribute('data-theme', 'dark');
                                            window.dispatchEvent(new Event('theme-changed'));
                                        }}
                                        className={`flex-1 sm:flex-none px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 justify-center ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30' : 'text-text-muted hover:text-text-main hover:bg-card-bg'}`}
                                    >
                                        <Moon size={14} />
                                        Dark
                                    </button>
                                </div>
                            </div>
                        </section>

                        <div className="text-center text-xs text-text-muted py-6">
                            <p className="font-bold">Dukan Sathi v1.2 Premium</p>
                            <p>Powered by Advanced Agentic AI Architecture</p>
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* AI Model Selection */}
                        <section className="glass-card rounded-3xl p-6">
                            <div className="flex flex-col mb-6">
                                <div className="flex items-center gap-2">
                                    <Brain className="text-indigo-500" size={24} />
                                    <h2 className="font-extrabold text-text-main text-lg transition-colors">AI Intelligence Engine</h2>
                                </div>
                                <p className="text-sm text-text-muted mt-1 transition-colors">Choose between blazing fast Cloud AI or private Offline Models.</p>
                            </div>

                            {ollamaStatus === 'offline' ? (
                                <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-4">
                                    <AlertCircle size={24} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-black text-amber-500 mb-1 uppercase tracking-wider">Local AI Status: Offline</p>
                                        <p className="text-text-main opacity-80 mb-3">To use 100% offline models, ensure Ollama is running on your machine.</p>
                                        <a href="https://ollama.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-indigo-500 hover:underline">
                                            Download Ollama <ChevronRight size={14} />
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {MODEL_OPTIONS.map((opt) => {
                                        const isDownloaded = localModels.some(m => m.name.includes(opt.id.split(':')[0]));

                                        return (
                                            <div key={opt.id} className="relative group">
                                                <button
                                                    onClick={() => {
                                                        setSelectedModel(selectedModel === opt.id ? 'llama-4-scout-17b-16e-instruct-maas' : opt.id);
                                                        markChange();
                                                    }}
                                                    className={`w-full p-5 rounded-2xl border text-left transition-all h-full ${selectedModel === opt.id
                                                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg ring-1 ring-indigo-500/50'
                                                        : 'border-card-border hover:border-indigo-500/30 hover:bg-card-bg'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="font-extrabold text-text-main transition-colors">{opt.label}</div>
                                                        {isDownloaded && (
                                                            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                                Ready
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-text-muted leading-relaxed pr-8 transition-colors">{opt.description}</div>

                                                    {selectedModel === opt.id &&
                                                        <div className="absolute top-5 right-5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-in zoom-in">
                                                            <Check size={12} className="text-white" />
                                                        </div>
                                                    }
                                                </button>
                                                {!isDownloaded && (
                                                    <button
                                                        onClick={() => installModel(opt.id)}
                                                        className="absolute bottom-5 right-5 p-2 text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                                                    >
                                                        {isInstalling === opt.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'voice' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Voice Selection */}
                        <section className="glass-card rounded-3xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Volume2 className="text-indigo-500" size={24} />
                                <h2 className="font-extrabold text-text-main text-lg transition-colors">Voice Persona</h2>
                            </div>

                            <div className="space-y-8">
                                {VOICE_OPTIONS.map((group) => (
                                    <div key={group.language}>
                                        <h3 className="text-xs font-black text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className="h-px bg-card-border flex-1" />
                                            {group.language}
                                            <div className="h-px bg-card-border flex-1" />
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {group.voices.map((voice) => (
                                                <div
                                                    key={voice.id}
                                                    className={`relative group flex items-center p-4 rounded-2xl border transition-all cursor-pointer ${selectedVoice === voice.id
                                                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg ring-1 ring-indigo-500/50'
                                                        : 'border-card-border hover:border-indigo-500/30 hover:bg-card-bg'
                                                        }`}
                                                    onClick={() => { setSelectedVoice(voice.id); markChange(); }}
                                                >
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 transition-all ${selectedVoice === voice.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-card-bg text-text-muted border border-card-border'}`}>
                                                        <User size={24} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className={`font-extrabold text-sm transition-colors ${selectedVoice === voice.id ? 'text-text-main' : 'text-text-muted group-hover:text-text-main'}`}>
                                                            {voice.label}
                                                        </div>
                                                        <div className="text-xs font-bold opacity-60 text-text-muted">{voice.gender}</div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); previewVoice(voice.id); }}
                                                        className={`p-2.5 rounded-xl hover:bg-white/10 transition-all ${playingVoice === voice.id ? 'text-indigo-500 scale-110' : 'text-text-muted'}`}
                                                    >
                                                        {playingVoice === voice.id ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Speed Control */}
                        <section className="glass-card rounded-3xl p-6">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2">
                                    <Gauge className="text-indigo-500" size={24} />
                                    <h2 className="font-extrabold text-text-main text-lg transition-colors">Speaking Cadence</h2>
                                </div>
                                <span className="text-sm font-black text-indigo-500 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20 shadow-sm">
                                    {voiceSpeed > 0 ? 'Turbo' : voiceSpeed < 0 ? 'Steady' : 'Natural'} ({voiceSpeed > 0 ? '+' : ''}{voiceSpeed}%)
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
                                    className="w-full h-2 bg-card-bg border border-card-border rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all"
                                />
                                <div className="flex justify-between text-[10px] text-text-muted mt-4 font-black uppercase tracking-widest transition-colors">
                                    <span>Relaxed</span>
                                    <span>Optimal</span>
                                    <span>Accelerated</span>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'branding' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Customer QR Code */}
                        <section className="glass-card rounded-[40px] p-10 flex flex-col items-center relative overflow-hidden group">
                            {/* Ambient Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/[0.03] rounded-full blur-[100px] -mr-32 -mt-32" />

                            <div className="flex items-center gap-3 mb-8 w-full relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5">
                                    <QrCode size={24} />
                                </div>
                                <div>
                                    <h2 className="font-black text-text-main text-xl tracking-tight transition-colors">Neural Store Identity</h2>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-0.5">Physical-to-Digital Bridge</p>
                                </div>
                            </div>

                            <p className="text-sm text-text-muted mb-10 text-center max-w-md transition-colors font-bold leading-relaxed relative z-10">
                                Deploy your store's AI access point. Print this premium poster to allow customers to interact with Sathi AI directly.
                            </p>

                            <div className="bg-white p-10 rounded-[48px] shadow-2xl shadow-indigo-500/20 border-[12px] border-indigo-500/[0.03] relative group mb-10 transition-all duration-700 hover:scale-105 hover:rotate-1 active:scale-95">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[36px]" />
                                <QRCodeCanvas
                                    id="qr-gen"
                                    value={`${window.location.origin}/store/${user?.id}`}
                                    size={240}
                                    level={"H"}
                                    fgColor={"#312e81"}
                                    bgColor={"#ffffff"}
                                />
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-indigo-600 px-8 py-2.5 rounded-full shadow-2xl ring-4 ring-indigo-500/10 active:scale-90 transition-transform cursor-default">
                                    <p className="font-black text-white text-[10px] tracking-[0.3em] whitespace-nowrap uppercase">Protocol: Active</p>
                                </div>
                            </div>

                            <button
                                onClick={downloadQRCode}
                                className="flex items-center gap-4 px-10 py-4 bg-indigo-600 text-white rounded-[20px] font-black text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-indigo-500/40 uppercase tracking-[0.2em] relative z-10"
                            >
                                <Download size={20} strokeWidth={2.5} />
                                Export Vector Manifest
                            </button>
                            <p className="mt-8 text-[9px] text-text-muted uppercase font-black tracking-[0.3em] opacity-40 hover:opacity-100 transition-opacity">Built with DukanSathi Agentic Neural Engine</p>
                        </section>
                    </div>
                )}
            </div>
        </div >
    );
};

export default Settings;
