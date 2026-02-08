import React, { useState, useEffect } from 'react';
import { Volume2, Check, User, Save, Loader2, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';

const VOICE_OPTIONS = [
    // Hindi Voices
    { id: 'hi-IN-MadhurNeural', label: 'Hindi - Male (Madhur)', lang: 'Hindi', gender: 'Male' },
    { id: 'hi-IN-SwaraNeural', label: 'Hindi - Female (Swara)', lang: 'Hindi', gender: 'Female' },

    // Indian English Voices
    { id: 'en-IN-PrabhatNeural', label: 'English (India) - Male (Prabhat)', lang: 'English', gender: 'Male' },
    { id: 'en-IN-NeerjaNeural', label: 'English (India) - Female (Neerja)', lang: 'English', gender: 'Female' }
];

const Settings = () => {
    const [selectedVoice, setSelectedVoice] = useState('hi-IN-MadhurNeural');
    const [voiceSpeed, setVoiceSpeed] = useState(0); // 0 means +0%, range -50 to +50
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);

    // Load Settings from Supabase
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                setUser(session.user);

                const { data, error } = await supabase
                    .from('profiles')
                    .select('voice_id, voice_speed')
                    .eq('id', session.user.id)
                    .single();

                if (data) {
                    if (data.voice_id) setSelectedVoice(data.voice_id);
                    // Parse speed string "+10%" -> 10
                    if (data.voice_speed) {
                        const speed = parseInt(data.voice_speed.replace('%', ''));
                        if (!isNaN(speed)) setVoiceSpeed(speed);
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

    const saveSettings = async () => {
        setSaving(true);
        try {
            const speedStr = (voiceSpeed >= 0 ? '+' : '') + voiceSpeed + '%';

            // Local updates
            localStorage.setItem('voice_id', selectedVoice);
            localStorage.setItem('voice_speed', speedStr);

            // Persist to Supabase
            const { error } = await supabase
                .from('profiles')
                .update({
                    voice_id: selectedVoice,
                    voice_speed: speedStr,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (error) throw error;
            setHasChanges(false);
            alert("Settings saved successfully!");

        } catch (err) {
            console.error("Error saving settings:", err);
            alert("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    // Handler for Voice Selection
    const handleVoiceChange = (voiceId) => {
        setSelectedVoice(voiceId);
        setHasChanges(true);
    };

    // Handler for Speed Slider
    const handleSpeedChange = (e) => {
        const newSpeed = parseInt(e.target.value);
        setVoiceSpeed(newSpeed);
        setHasChanges(true);
    };

    // No auto-save on commit
    const handleSpeedCommit = () => { };

    // Preview Voice Function (Server-Side)
    const previewVoice = async () => {
        const text = selectedVoice.includes('hi') ? "Namaste! Main Sathi AI hoon." : "Hello! I am Sathi AI.";

        try {
            // Visual feedback
            const btn = document.getElementById('preview-btn');
            if (btn) btn.disabled = true;

            // 1. Fetch Audio Blob (Base64)
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/tts-preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voice_id: selectedVoice,
                    rate: (voiceSpeed >= 0 ? '+' : '') + voiceSpeed + '%'
                })
            });

            if (!response.ok) throw new Error("Preview failed");

            const data = await response.json();

            // 2. Play Audio
            const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
            audio.onended = () => { if (btn) btn.disabled = false; };
            await audio.play();

        } catch (error) {
            console.error("Preview Error:", error);
            // Fallback to native if server fails
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0 + (voiceSpeed / 100);
            window.speechSynthesis.speak(utterance);

            const btn = document.getElementById('preview-btn');
            if (btn) btn.disabled = false;
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
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                    <User size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Settings</h1>
                    <p className="text-xs text-slate-500">Manage your preferences</p>
                </div>
            </div>

            <div className="p-4 space-y-6 overflow-y-auto pb-20">

                {/* Voice Settings Section */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Volume2 className="text-indigo-600" size={20} />
                            <h2 className="font-semibold text-slate-700">AI Voice</h2>
                        </div>
                        {saving && <span className="text-xs text-emerald-600 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving...</span>}
                    </div>

                    <p className="text-sm text-slate-500 mb-6">
                        Choose the voice and speed for Sathi AI.
                    </p>

                    {/* Voice Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                        {VOICE_OPTIONS.map((voice) => (
                            <button
                                key={voice.id}
                                onClick={() => handleVoiceChange(voice.id)}
                                className={`relative flex items-center p-3 rounded-xl border transition-all text-left ${selectedVoice === voice.id
                                    ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-600'
                                    : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                                    }`}
                            >
                                <div className={`w-3 h-3 rounded-full mr-3 ${selectedVoice === voice.id ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                                <div>
                                    <div className={`font-medium text-sm ${selectedVoice === voice.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                                        {voice.label}
                                    </div>
                                    <div className="text-xs opacity-60 text-slate-500">{voice.lang} • {voice.gender}</div>
                                </div>
                                {selectedVoice === voice.id && <Check size={16} className="absolute top-3 right-3 text-indigo-600" />}
                            </button>
                        ))}
                    </div>

                    {/* Speed Control */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-slate-700">Voice Speed</label>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                                {voiceSpeed > 0 ? '+' : ''}{voiceSpeed}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="-50"
                            max="50"
                            step="5"
                            value={voiceSpeed}
                            onChange={handleSpeedChange}
                            onMouseUp={handleSpeedCommit}
                            onTouchEnd={handleSpeedCommit}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>Slower</span>
                            <span>Normal</span>
                            <span>Faster</span>
                        </div>
                    </div>

                    {/* Preview Button */}
                    <button
                        id="preview-btn"
                        onClick={previewVoice}
                        className="mt-6 w-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play size={16} fill="currentColor" /> Test Voice (Server Preview)
                    </button>

                </div>

                {/* More settings placeholders */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 opacity-60">
                    <h2 className="font-semibold text-slate-700 mb-2">Notification Settings</h2>
                    <p className="text-xs text-slate-400">Coming Soon...</p>
                </div>
            </div>
        </div>
    );
};

export default Settings;
