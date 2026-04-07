import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Check, User, Save, Loader2, Play, Brain, Gauge, Cpu, Download, RefreshCw, AlertCircle, Moon, Sun, ChevronRight, Settings2 as SettingsIcon, Briefcase, MapPin, CreditCard, Building2, FileText, Cloud, CloudOff, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { syncEngine } from '../lib/db/syncEngine';
import { usePWA } from '../hooks/usePWA';

const VOICE_OPTIONS = [
    {
        language: 'Hindi (Hinglish)',
        desc: 'Clear & Reliable — Google TTS',
        voices: [
            { id: 'hi-IN-MadhurNeural', label: 'Madhur (Male)', gender: 'Male', quality: 'Google Neural2' },
            { id: 'hi-IN-SwaraNeural', label: 'Swara (Female)', gender: 'Female', quality: 'Google Neural2' }
        ]
    },
    {
        language: 'English (India)',
        desc: 'Clear Indian English — Google Neural2',
        voices: [
            { id: 'en-IN-PrabhatNeural', label: 'Prabhat (Male)', gender: 'Male', quality: 'Google Neural2' },
            { id: 'en-IN-NeerjaNeural', label: 'Neerja (Female)', gender: 'Female', quality: 'Google Neural2' }
        ]
    },
    {
        language: 'বাংলা (Kolkata Bangla)',
        desc: 'Natural & Expressive — Sarvam AI ✨',
        voices: [
            { id: 'bn-IN-BashkarNeural', label: 'Shubh (Male)', gender: 'Male', quality: 'Sarvam AI ✨' },
            { id: 'bn-IN-TanishaNeural', label: 'Priya (Female)', gender: 'Female', quality: 'Sarvam AI ✨' }
        ]
    },
];

const AI_LANGUAGES = [
    { id: 'hinglish', label: 'Hinglish', desc: 'Hindi + English mix (Roman script)' },
    { id: 'english', label: 'English', desc: 'Clear Indian English' },
    { id: 'bangla', label: 'বাংলা', desc: 'Kolkata colloquial Bangla' },
];

// Auto-derive AI language from voice ID prefix
// This ensures Groq STT and ElevenLabs TTS both use the correct language code
const VOICE_TO_LANGUAGE = {
    'hi-IN': 'hinglish',
    'bn-IN': 'bangla',
    'en-IN': 'english',
    'en-US': 'english',
};
const deriveLanguageFromVoice = (voiceId = '') => {
    const prefix = voiceId.split('-').slice(0, 2).join('-');
    return VOICE_TO_LANGUAGE[prefix] || 'hinglish';
};



const Settings = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(window.innerWidth < 768 ? 'preferences' : 'business'); // 'voice' | 'business' | 'preferences'
    const [selectedVoice, setSelectedVoice] = useState('en-IN-PrabhatNeural');
    const [voiceSpeed, setVoiceSpeed] = useState(0);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const { isInstallable, installApp } = usePWA();
    const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const [playingVoice, setPlayingVoice] = useState(null); // ID of currently playing preview

    // System State
    const [hardware, setHardware] = useState(null);
    const [aiLanguage, setAiLanguage] = useState(localStorage.getItem('ai_language') || 'hinglish');
    const [businessData, setBusinessData] = useState({
        business_name: '',
        owner_name: '',
        business_address: '',
        city: '',
        state_name: '',
        pincode: '',
        gstin: '',
        whatsapp_number: '',
        is_gst_registered: false,
        bank_name: '',
        bank_account_no: '',
        bank_ifsc: '',
        upi_id: '',
        show_qr_on_invoice: true,
        invoice_theme: 'classic',
        sync_enabled: localStorage.getItem('sync_enabled') !== 'false'
    });

    let rawApiBase = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
    const API_BASE = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;

    // Load Settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                // 1. Load from LocalStorage (Fast)
                const localVoice = localStorage.getItem('voice_id');
                const localSpeed = localStorage.getItem('voice_speed');
                if (localVoice) setSelectedVoice(localVoice);
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
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (data) {
                        if (data.voice_id) {
                            setSelectedVoice(data.voice_id);
                            localStorage.setItem('voice_id', data.voice_id);
                        }
                        if (data.voice_speed) {
                            const speed = parseInt(data.voice_speed.replace('%', ''));
                            if (!isNaN(speed)) {
                                setVoiceSpeed(speed);
                                localStorage.setItem('voice_speed', data.voice_speed);
                            }
                        }
                        if (data.ai_language) {
                            setAiLanguage(data.ai_language);
                            localStorage.setItem('ai_language', data.ai_language);
                        }

                        // Load Business Data
                        setBusinessData({
                            business_name: data.business_name || '',
                            owner_name: data.owner_name || '',
                            business_address: data.business_address || '',
                            city: data.city || '',
                            state_name: data.state_name || '',
                            pincode: data.pincode || '',
                            gstin: data.gstin || '',
                            whatsapp_number: data.whatsapp_number || '',
                            is_gst_registered: data.is_gst_registered || false,
                            bank_name: data.bank_name || '',
                            bank_account_no: data.bank_account_no || '',
                            bank_ifsc: data.bank_ifsc || '',
                            upi_id: data.upi_id || '',
                            show_qr_on_invoice: data.show_qr_on_invoice !== false,
                            invoice_theme: data.invoice_theme || 'classic'
                        });
                    }
                }

                // Load Hardware Status intentionally skipped (cloud-only mode)

            } catch (err) {
                console.error("Error loading settings:", err);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();

        const unsubscribe = syncEngine.subscribe((status) => {
            setSyncStatus(status);
        });

        return () => unsubscribe();
    }, []);

    const handleSyncToggle = () => {
        const newState = !businessData.sync_enabled;
        setBusinessData(prev => ({ ...prev, sync_enabled: newState }));
        syncEngine.setSyncEnabled(newState);
        localStorage.setItem('sync_enabled', String(newState));
        window.dispatchEvent(new CustomEvent('sync-toggle-changed', { detail: { isSyncing: newState } }));
        markChange();
    };

    const triggerManualSync = () => {
        if (navigator.onLine) {
            syncEngine.syncAll();
        }
    };


    const getAuthHeaders = async (additionalHeaders = {}) => {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { ...additionalHeaders };
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        return headers;
    };

    // Hardware check removed — app is cloud-only.
    // fetchHardware was calling a deleted endpoint (/api/setup/hardware).




    const [hasChanges, setHasChanges] = useState(false);
    const markChange = () => setHasChanges(true);

    const saveSettings = async () => {
        setSaving(true);
        try {
            const speedStr = (voiceSpeed >= 0 ? '+' : '') + voiceSpeed + '%';

            // Auto-derive language from voice as a safety net — ensures Groq STT gets right language
            const derivedLanguage = deriveLanguageFromVoice(selectedVoice);
            const effectiveLanguage = derivedLanguage; // language always follows voice
            if (effectiveLanguage !== aiLanguage) {
                setAiLanguage(effectiveLanguage);
            }

            localStorage.setItem('voice_id', selectedVoice);
            localStorage.setItem('voice_speed', speedStr);
            localStorage.setItem('ai_language', effectiveLanguage);

            window.dispatchEvent(new Event('settings-changed'));
            window.dispatchEvent(new Event('storage'));

            if (user) {
                // Separate out fields not in the DB schema before upserting
                const { sync_enabled, ...dbSafeBusinessData } = businessData;
                const { error } = await supabase
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        voice_id: selectedVoice,
                        voice_speed: speedStr,
                        ai_language: effectiveLanguage,
                        updated_at: new Date().toISOString(),
                        ...dbSafeBusinessData
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
        // Use the correct preview text for each language
        let text = "Hello! I am Sathi AI.";
        if (voiceId.startsWith('hi-IN')) text = "Namaste Boss! Main Sathi AI hoon. Aaj kya help karu?";
        if (voiceId.startsWith('bn-IN')) text = "নমস্কার দাদা! আমি সাথী এআই। আজ কী সাহায্য করব?";
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



    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    const TabButton = ({ id, icon: Icon, label, className = '' }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all border ${activeTab === id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                : 'text-text-muted border-transparent hover:bg-card-bg hover:text-text-main'
                } ${className || 'flex'}`}
        >
            <Icon size={16} className="md:w-[18px] md:h-[18px]" />
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden relative">
            <header className="flex flex-col md:flex-row md:items-end justify-between px-4 md:px-6 pt-4 md:pt-6 gap-4 md:gap-6 relative z-10 w-full">
                <div className="flex items-center gap-3 md:gap-5">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-[18px] md:rounded-[22px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform hover:scale-110">
                        <SettingsIcon className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Settings</h1>
                        <p className="text-[9px] md:text-[10px] font-black text-text-muted uppercase tracking-[0.2em] md:tracking-[0.3em] mt-0.5 md:mt-1 transition-colors truncate max-w-[200px] md:max-w-none">Manage your store preferences</p>
                    </div>
                </div>

                <button
                    onClick={saveSettings}
                    disabled={saving || !hasChanges}
                    className={`flex items-center justify-center md:justify-start gap-4 px-6 md:px-10 py-3 md:py-4 rounded-2xl md:rounded-2xl font-black transition-all tracking-[0.2em] text-[10px] uppercase shadow-xl md:shadow-2xl w-full md:w-auto ${hasChanges
                        ? 'bg-indigo-600 text-white shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-card-bg/50 text-text-muted border border-card-border/50 cursor-not-allowed opacity-50'
                        }`}
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />}
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </header>

            <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 overflow-x-auto whitespace-nowrap scrollbar-hide z-10 w-full">
                <TabButton id="business" icon={Briefcase} label="Business Settings" />
                <TabButton id="voice" icon={Volume2} label="Voice & Language" />
                <TabButton id="preferences" icon={Cpu} label="Preferences" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 relative z-0">

                {activeTab === 'business' && (
                    // Business settings for profiles, location, and payments
                    //
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Business Core Info */}
                        <section className="glass-card rounded-[32px] p-5 md:p-8 border-indigo-500/10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform hover:scale-110">
                                    <Building2 size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black font-heading text-text-main tracking-tight">Business Profile</h2>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Core Business Credentials</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">Business Name</label>
                                    <input
                                        placeholder="Ex: Matrix Corp"
                                        className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 outline-none transition-all font-bold text-text-main"
                                        value={businessData.business_name}
                                        onChange={e => { setBusinessData({ ...businessData, business_name: e.target.value }); markChange(); }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">Owner Name</label>
                                    <input
                                        placeholder="Ex: John Matrix"
                                        className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 outline-none transition-all font-bold text-text-main"
                                        value={businessData.owner_name}
                                        onChange={e => { setBusinessData({ ...businessData, owner_name: e.target.value }); markChange(); }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">WhatsApp Number</label>
                                    <input
                                        placeholder="+91 XXXXX XXXXX"
                                        className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 outline-none transition-all font-bold text-text-main"
                                        value={businessData.whatsapp_number}
                                        onChange={e => { setBusinessData({ ...businessData, whatsapp_number: e.target.value }); markChange(); }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">GSTIN (Tax ID)</label>
                                    <input
                                        placeholder="27AAAAA0000A1Z5"
                                        className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-indigo-500 outline-none transition-all font-bold text-text-main uppercase"
                                        value={businessData.gstin}
                                        onChange={e => { setBusinessData({ ...businessData, gstin: e.target.value.toUpperCase() }); markChange(); }}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Location Details */}
                        <section className="glass-card rounded-[32px] p-5 md:p-8 border-purple-500/10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 shadow-xl shadow-purple-500/5 transition-transform hover:scale-110">
                                    <MapPin size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black font-heading text-text-main tracking-tight">Location Details</h2>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Physical Location Nodes</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">Primary Address</label>
                                    <textarea
                                        placeholder="Full business office address..."
                                        rows={3}
                                        className="w-full p-5 bg-card-bg/50 rounded-2xl border border-card-border focus:border-purple-500 outline-none transition-all font-bold text-text-main resize-none"
                                        value={businessData.business_address}
                                        onChange={e => { setBusinessData({ ...businessData, business_address: e.target.value }); markChange(); }}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">City</label>
                                        <input
                                            placeholder="Ex: Mumbai"
                                            className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-purple-500 outline-none transition-all font-bold text-text-main"
                                            value={businessData.city}
                                            onChange={e => { setBusinessData({ ...businessData, city: e.target.value }); markChange(); }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">State / UT</label>
                                        <input
                                            placeholder="Ex: Maharashtra"
                                            className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-purple-500 outline-none transition-all font-bold text-text-main"
                                            value={businessData.state_name}
                                            onChange={e => { setBusinessData({ ...businessData, state_name: e.target.value }); markChange(); }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">Pincode</label>
                                        <input
                                            placeholder="XXXXXX"
                                            className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-purple-500 outline-none transition-all font-bold text-text-main"
                                            value={businessData.pincode}
                                            onChange={e => { setBusinessData({ ...businessData, pincode: e.target.value }); markChange(); }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Financial Routing */}
                        <section className="glass-card rounded-[32px] p-5 md:p-8 border-emerald-500/10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/5 transition-transform hover:scale-110">
                                    <CreditCard size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black font-heading text-text-main tracking-tight">Bank Details</h2>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Bank Settlement Details</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">Bank Name</label>
                                    <input
                                        placeholder="Ex: HDFC Bank"
                                        className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-emerald-500 outline-none transition-all font-bold text-text-main"
                                        value={businessData.bank_name}
                                        onChange={e => { setBusinessData({ ...businessData, bank_name: e.target.value }); markChange(); }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">Account Number</label>
                                    <input
                                        placeholder="Acc No: XXXXXXXX"
                                        className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-emerald-500 outline-none transition-all font-bold text-text-main font-mono"
                                        value={businessData.bank_account_no}
                                        onChange={e => { setBusinessData({ ...businessData, bank_account_no: e.target.value }); markChange(); }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">IFSC Code</label>
                                    <input
                                        placeholder="HDFC000XXXX"
                                        className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-emerald-500 outline-none transition-all font-bold text-text-main font-mono uppercase"
                                        value={businessData.bank_ifsc}
                                        onChange={e => { setBusinessData({ ...businessData, bank_ifsc: e.target.value.toUpperCase() }); markChange(); }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] ml-1">Unified Payments Interface [UPI ID] (Optional)</label>
                                    <input
                                        placeholder="Ex: example@upi"
                                        className="w-full p-4 bg-card-bg/50 rounded-2xl border border-card-border focus:border-emerald-500 outline-none transition-all font-bold text-text-main"
                                        value={businessData.upi_id}
                                        onChange={e => { setBusinessData({ ...businessData, upi_id: e.target.value }); markChange(); }}
                                    />
                                </div>
                                <div className="hidden lg:block lg:pt-6" /> 
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'preferences' && (
                    // System preferences and integrations
                    //
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* System Hardware section removed — app is cloud-only */}

                        {/* App Theme */}
                        <section className="glass-card rounded-3xl p-4 sm:p-6 border-indigo-500/10 bg-indigo-500/[0.01]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
                                <div className="flex items-center gap-4 w-full">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform group-hover:scale-110">
                                        {theme === 'light' ? <Moon size={24} className="sm:w-7 sm:h-7" /> : <Sun size={24} className="sm:w-7 sm:h-7" />}
                                    </div>
                                    <div>
                                        <h2 className="text-lg sm:text-xl font-black font-heading text-text-main transition-colors tracking-tight">App Theme</h2>
                                        <p className="text-[9px] sm:text-[10px] font-black text-text-muted uppercase tracking-[0.2em] transition-colors mt-0.5 sm:mt-1">Light / Dark Mode</p>
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

                        {/* Invoice Theme */}
                        <section className="glass-card rounded-3xl p-4 sm:p-6 border-amber-500/10 bg-amber-500/[0.01]">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/5">
                                    <FileText size={28} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black font-heading text-text-main transition-colors tracking-tight">Invoice Template</h2>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] transition-colors mt-1">PDF Style for GST & Non-GST Bills</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { id: 'classic', label: 'Classic', desc: 'Dark header, indigo accents, rounded cards', color: 'indigo' },
                                    { id: 'minimal', label: 'Minimal', desc: 'Clean white, thin borders, serif font', color: 'gray' },
                                    { id: 'thermal', label: 'Thermal', desc: '80mm receipt, mono font, compact', color: 'slate' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => { setBusinessData({ ...businessData, invoice_theme: opt.id }); markChange(); }}
                                        className={`p-4 rounded-2xl border text-left transition-all ${
                                            businessData.invoice_theme === opt.id
                                                ? 'border-indigo-500 bg-indigo-500/10 shadow-lg ring-1 ring-indigo-500/50'
                                                : 'border-card-border hover:border-indigo-500/30 hover:bg-card-bg'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-black text-text-main text-sm uppercase tracking-wider">{opt.label}</span>
                                            {businessData.invoice_theme === opt.id && (
                                                <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                                    <Check size={12} className="text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-text-muted font-bold leading-relaxed">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Data & Sync */}
                        <section className="glass-card rounded-[32px] p-5 md:p-8 border-indigo-500/10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5">
                                    <RefreshCw size={28} className={syncStatus.status === 'syncing' ? 'animate-spin' : ''} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black font-heading text-text-main tracking-tight">Data & Sync</h2>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mt-1">Cloud Synchronization & Offline Storage</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-card-bg/30 rounded-[24px] border border-card-border/50">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${businessData.sync_enabled ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                                {businessData.sync_enabled ? <Cloud size={20} /> : <CloudOff size={20} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-text-main uppercase tracking-tighter transition-colors">Auto Sync</p>
                                                <p className="text-[10px] text-text-muted font-bold">Automatically backup data to cloud</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSyncToggle}
                                            className={`w-12 h-6 rounded-full transition-all relative ${businessData.sync_enabled ? 'bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.4)]' : 'bg-slate-300 dark:bg-slate-700'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm ${businessData.sync_enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-card-bg/30 rounded-[24px] border border-card-border/50">
                                        <div className="flex items-center gap-4 max-w-[70%]">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-500`}>
                                                <RefreshCw size={20} className={syncStatus.status === 'syncing' ? 'animate-spin' : ''} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-text-main uppercase tracking-tighter">
                                                    {syncStatus.status === 'syncing' ? 'Sync in Progress...' : 'Database Encrypted'}
                                                </p>
                                                <p className="text-[10px] text-text-muted font-bold truncate">
                                                    {syncStatus.message || 'All data is synchronized securely.'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={triggerManualSync}
                                            disabled={syncStatus.status === 'syncing' || !navigator.onLine}
                                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-95"
                                        >
                                            Sync Now
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {isInstallable && (
                                        <div className="p-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[28px] text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                                            <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                                <Download size={120} />
                                            </div>
                                            <div className="relative z-10">
                                                <h3 className="text-lg font-black tracking-tight mb-1">Desktop Experience</h3>
                                                <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider mb-4 leading-relaxed">
                                                    Install Dukan Sathi for a faster, offline-capable workflow.
                                                </p>
                                                <button
                                                    onClick={async () => {
                                                        await installApp();
                                                        window.location.reload();
                                                    }}
                                                    className="w-full py-3 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors shadow-lg"
                                                >
                                                    Install Desktop App
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div className={`p-6 rounded-[28px] border border-card-border/50 flex flex-col justify-center items-center text-center ${!isInstallable ? 'h-full bg-card-bg/20' : 'bg-card-bg/10'}`}>
                                        <Shield size={24} className="text-indigo-500 mb-2 opacity-50" />
                                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Version 1.2.0-beta</p>
                                        <p className="text-[8px] text-text-muted/60 mt-1">E2E Encryption Enabled • AES-256</p>
                                    </div>
                                </div>
                            </div>
                        </section>


                        <div className="text-center text-xs text-text-muted py-6">
                            <p className="font-bold">Dukan Sathi v1.2 Premium</p>
                            <p>Powered by Advanced Agentic AI Architecture</p>
                        </div>
                    </div>
                )}



                {activeTab === 'voice' && (
                    // Voice configuration and language preferences
                    //
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* AI Language Preference */}
                        <section className="glass-card rounded-3xl p-4 sm:p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Brain className="text-indigo-500" size={24} />
                                <h2 className="font-extrabold text-text-main text-lg">AI Language</h2>
                            </div>
                            <p className="text-sm text-text-muted mb-4 font-medium">Choose the language OpenClaw AI speaks and listens in.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {AI_LANGUAGES.map((lang) => (
                                    <button
                                        key={lang.id}
                                        onClick={() => { setAiLanguage(lang.id); markChange(); }}
                                        className={`p-4 rounded-2xl border text-left transition-all ${
                                            aiLanguage === lang.id
                                                ? 'border-indigo-500 bg-indigo-500/10 shadow-lg ring-1 ring-indigo-500/50'
                                                : 'border-card-border hover:border-indigo-500/30 hover:bg-card-bg'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-black text-text-main text-base">{lang.label}</span>
                                            {aiLanguage === lang.id && (
                                                <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                                    <Check size={12} className="text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-text-muted font-medium">{lang.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Voice Persona */}
                        <section className="glass-card rounded-3xl p-4 sm:p-6">
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
                                                    onClick={() => {
                                                        setSelectedVoice(voice.id);
                                                        // Auto-sync AI language to match the selected voice persona
                                                        // This ensures Groq STT and ElevenLabs TTS both use the right language
                                                        const autoLang = deriveLanguageFromVoice(voice.id);
                                                        setAiLanguage(autoLang);
                                                        markChange();
                                                    }}
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
                        <section className="glass-card rounded-3xl p-4 sm:p-6">
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


            </div>
        </div >
    );
};

export default Settings;
