import React, { useState, useEffect } from 'react';
import { Volume2, Check, User } from 'lucide-react';

const VOICE_OPTIONS = [
    { id: 'hi-IN-MadhurNeural', label: 'Hindi - Male (Madhur)', lang: 'Hindi', gender: 'Male' },
    { id: 'hi-IN-SwaraNeural', label: 'Hindi - Female (Swara)', lang: 'Hindi', gender: 'Female' },
    { id: 'en-IN-PrabhatNeural', label: 'English - Male (Prabhat)', lang: 'English', gender: 'Male' },
    { id: 'en-IN-NeerjaNeural', label: 'English - Female (Neerja)', lang: 'English', gender: 'Female' },
];

const Profile = () => {
    const [selectedVoice, setSelectedVoice] = useState('hi-IN-MadhurNeural');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('voice_id');
        if (stored) setSelectedVoice(stored);
    }, []);

    const handleVoiceChange = (voiceId) => {
        setSelectedVoice(voiceId);
        localStorage.setItem('voice_id', voiceId);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

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

            <div className="p-4 space-y-6">

                {/* Voice Settings Section */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Volume2 className="text-indigo-600" size={20} />
                        <h2 className="font-semibold text-slate-700">AI Voice</h2>
                    </div>

                    <p className="text-sm text-slate-500 mb-4">
                        Choose the voice for Sathi AI. This will be used when the AI speaks back to you.
                    </p>

                    <div className="space-y-3">
                        {VOICE_OPTIONS.map((voice) => (
                            <button
                                key={voice.id}
                                onClick={() => handleVoiceChange(voice.id)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${selectedVoice === voice.id
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 hover:border-indigo-200 text-slate-600'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${selectedVoice === voice.id ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                                    <div className="text-left">
                                        <div className="font-medium text-sm">{voice.label}</div>
                                        <div className="text-xs opacity-70">{voice.lang} • {voice.gender}</div>
                                    </div>
                                </div>
                                {selectedVoice === voice.id && <Check size={18} className="text-indigo-600" />}
                            </button>
                        ))}
                    </div>

                    {saved && (
                        <div className="mt-3 text-center text-xs font-medium text-emerald-600 bg-emerald-50 py-1 rounded-lg animate-fade-in">
                            Running on Microsoft Edge Neural TTS (Free)
                        </div>
                    )}
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

export default Profile;
