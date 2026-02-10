import React, { useState, useEffect } from 'react';
import { Volume2, Check, User, Save, Loader2, Play, Brain, Gauge } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
    {
        language: 'English (India)',
        voices: [
            { id: 'en-IN-PrabhatNeural', label: 'Prabhat (Male)', gender: 'Male' },
            { id: 'en-IN-NeerjaNeural', label: 'Neerja (Female)', gender: 'Female' }
        ]
    },
    {
        language: 'Bengali (India)',
        voices: [
            { id: 'bn-IN-Wavenet-B', label: 'Bashir (Male)', gender: 'Male' },
            { id: 'bn-IN-Wavenet-A', label: 'Benazir (Female)', gender: 'Female' }
        ]
    }
];

const MODEL_OPTIONS = [
    { id: 'gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (Fastest)', description: 'Best for quick chats and simple actions.' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Smarter)', description: 'Better reasoning for complex business queries.' }
];

const Settings = () => {
    const [selectedVoice, setSelectedVoice] = useState('en-IN-PrabhatNeural');
    const [voiceSpeed, setVoiceSpeed] = useState(0); // 0 means +0%, range -50 to +50
    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash-001');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const [playingVoice, setPlayingVoice] = useState(null); // ID of currently playing preview

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
                    return;
                }
                setUser(session.user);

                const { data, error } = await supabase
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
            } catch (err) {
                console.error("Error loading settings:", err);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, []);

    const [hasChanges, setHasChanges] = useState(false);

    const markChange = () => setHasChanges(true);

    const saveSettings = async () => {
        setSaving(true);
        try {
            const speedStr = (voiceSpeed >= 0 ? '+' : '') + voiceSpeed + '%';

            // 1. Local Persistence
            localStorage.setItem('voice_id', selectedVoice);
            localStorage.setItem('voice_speed', speedStr);
            localStorage.setItem('model_id', selectedModel);

            // 2. Dispatch Event for useChat.js
            window.dispatchEvent(new Event('settings-changed'));
            window.dispatchEvent(new Event('storage')); // Fallback for some listeners

            // 3. Cloud Persistence
            if (user) {
                // Upsert logic handles both insert/update
                const { error } = await supabase
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        voice_id: selectedVoice,
                        voice_speed: speedStr,
                        model_id: selectedModel, // Requires migration
                        updated_at: new Date().toISOString()
                    });

                if (error) {
                    console.warn("Cloud save warning (column might be missing):", error.message);
                    // Don't throw if just column missing, local save is enough for now
                }
            }

            setHasChanges(false);
            alert("Settings saved successfully!");
            // Better UX: Show button state

        } catch (err) {
            console.error("Error saving settings:", err);
            alert("Failed to save settings to cloud (Local save worked)");
        } finally {
            setSaving(false);
        }
    };

    // Preview Voice
    const previewVoice = async (voiceId) => {
        if (playingVoice) return; // Prevent multiple clicks
        setPlayingVoice(voiceId);

        const text = voiceId.includes('hi') ? "Namaste! Main Sathi AI hoon." : "Hello! I am Sathi AI.";

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/tts-preview`, {
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
            // Fallback
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
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
            {/* Header */}
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

                {/* Save Button (Always Visible) */}
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

                {/* 1. AI Model Selection */}
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Brain className="text-indigo-600" size={20} />
                        <h2 className="font-semibold text-slate-800">AI Model</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {MODEL_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => { setSelectedModel(opt.id); markChange(); }}
                                className={`relative p-4 rounded-xl border text-left transition-all ${selectedModel === opt.id
                                    ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600'
                                    : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                                    }`}
                            >
                                <div className="font-semibold text-slate-800 mb-1">{opt.label}</div>
                                <div className="text-xs text-slate-500 leading-relaxed">{opt.description}</div>
                                {selectedModel === opt.id &&
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                                        <Check size={12} className="text-white" />
                                    </div>
                                }
                            </button>
                        ))}
                    </div>
                </section>

                {/* 2. Voice Selection */}
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Volume2 className="text-indigo-600" size={20} />
                        <h2 className="font-semibold text-slate-800">Voice</h2>
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
                                            {/* Selection Click Area */}
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

                                            {/* Preview Button */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); previewVoice(voice.id); }}
                                                disabled={playingVoice !== null}
                                                className={`p-2 rounded-full hover:bg-white hover:shadow-sm transition-all ml-2 ${playingVoice === voice.id ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`}
                                            >
                                                {playingVoice === voice.id ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                                            </button>

                                            {selectedVoice === voice.id &&
                                                <div className="absolute top-2 right-2">
                                                    {/* Checkmark indicator usually here but design is clean without it too */}
                                                </div>
                                            }
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. Speed Control */}
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

                {/* Info Footer */}
                <div className="text-center text-xs text-slate-400 py-6">
                    <p>Dukan Sathi v1.0 • Powered by Moltbot AI</p>
                    <p>Voice generated by Microsoft Edge Neural TTS</p>
                </div>
            </div>
        </div>
    );
};

export default Settings;
