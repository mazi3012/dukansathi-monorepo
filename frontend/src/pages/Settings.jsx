import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Check, User, Save, Loader2, Play, Brain, Gauge, Cpu, Download, RefreshCw, AlertCircle, QrCode } from 'lucide-react';
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
    const [selectedVoice, setSelectedVoice] = useState('en-IN-PrabhatNeural');
    const [voiceSpeed, setVoiceSpeed] = useState(0); // 0 means +0%, range -50 to +50
    const [selectedModel, setSelectedModel] = useState('llama-4-scout-17b-16e-instruct-maas');

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

                {/* AI Model Selection — always visible */}
                <section className="bg-white rounded-[24px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                    <div className="flex flex-col mb-4">
                        <div className="flex items-center gap-2">
                            <Brain className="text-indigo-600" size={20} />
                            <h2 className="font-semibold text-slate-800">Local AI Models</h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Select a model to run fully offline. Click the selected model again to deselect and use the default Cloud AI.</p>
                    </div>

                    {ollamaStatus === 'offline' ? (
                        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                            <AlertCircle size={22} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-bold text-amber-900 mb-1">🔧 Offline AI — Developer Feature</p>
                                <p className="mb-2">Local AI works only on the developer machine running Ollama. This feature is <strong>under development</strong> for web deployment.</p>
                                <p className="text-xs text-amber-600">Meanwhile, the <strong>Cloud AI</strong> (Llama-4 Scout) is fully functional and recommended for all users. Install Ollama from <a href="https://ollama.com" className="underline font-bold" target="_blank" rel="noreferrer">ollama.com</a> if you are a developer.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {MODEL_OPTIONS.map((opt) => {
                                const isLocal = opt.id.includes(':') || opt.id.includes('phi') || opt.id.includes('gemma');
                                const isDownloaded = localModels.some(m => m.name.includes(opt.id.split(':')[0]));

                                return (
                                    <div key={opt.id} className="relative">
                                        <button
                                            onClick={() => {
                                                setSelectedModel(selectedModel === opt.id ? 'llama-4-scout-17b-16e-instruct-maas' : opt.id);
                                                markChange();
                                            }}
                                            className={`w-full p-4 rounded-xl border text-left transition-all h-full ${selectedModel === opt.id
                                                    ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600'
                                                    : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="font-semibold text-slate-800">{opt.label}</div>
                                                {isLocal && (
                                                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${isDownloaded ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                                        }`}>
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

                {/* Customer QR Code */}
                {user && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-4 w-full">
                            <QrCode className="text-indigo-600" size={20} />
                            <h2 className="font-semibold text-slate-800">Customer QR Code</h2>
                        </div>
                        <p className="text-sm text-slate-500 mb-6 text-center">
                            Print this QR code and paste it in your shop. Customers can scan it to chat with your AI assistant and place orders automatically!
                        </p>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center mb-4">
                            <QRCodeCanvas
                                id="qr-gen"
                                value={`${window.location.origin}/store/${user.id}`}
                                size={200}
                                level={"H"}
                                fgColor={"#312e81"} // indigo-900
                                bgColor={"#ffffff"}
                            />
                            <p className="mt-4 font-bold text-indigo-900 tracking-wide">SCAN TO ORDER</p>
                            <p className="text-xs text-indigo-600 font-medium">Powered by DukanSathi AI</p>
                        </div>

                        <button
                            onClick={downloadQRCode}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                        >
                            <Download size={18} />
                            Download QR Poster
                        </button>
                    </section>
                )}

                <div className="text-center text-xs text-slate-400 py-6">
                    <p>Dukan Sathi v1.1 • Powered by Moltbot AI</p>
                    <p>Local AI powered by Ollama</p>
                </div>
            </div>
        </div >
    );
};

export default Settings;
