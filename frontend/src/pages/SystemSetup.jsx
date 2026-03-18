import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Save, Loader2, Database } from 'lucide-react';
import { toast } from 'react-hot-toast';

const SystemSetup = () => {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);

    // Config states
    const [config, setConfig] = useState({
        supabase_url: localStorage.getItem('supabase_url') || '',
        supabase_key: localStorage.getItem('supabase_key') || '',
        groq_api_key: localStorage.getItem('groq_api_key') || ''
    });

    const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
    const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            localStorage.setItem('supabase_url', config.supabase_url);
            localStorage.setItem('supabase_key', config.supabase_key);
            localStorage.setItem('groq_api_key', config.groq_api_key);

            const res = await fetch(`${API_URL}/api/setup/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    SUPABASE_URL: config.supabase_url,
                    SUPABASE_SERVICE_KEY: config.supabase_key,
                    GROQ_API_KEY: config.groq_api_key
                })
            }).catch(() => ({ ok: true })); // Fallback if backend not running (PWA local-only setup)

            if (res.ok) {
                toast.success("Configuration Secured");
                navigate('/');
            }
        } catch (err) {
            toast.error("Failed to save config");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />

            <div className="max-w-2xl w-full glass-card rounded-[48px] border border-card-border shadow-2xl overflow-hidden relative z-10 p-0">
                {/* Header Section */}
                <div className="p-10 border-b border-card-border/50 relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                    <div className="flex items-center gap-6 mb-2">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform hover:rotate-6">
                            <Database size={40} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Store Setup</h1>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em] mt-2 transition-colors">System Configuration</p>
                        </div>
                    </div>
                </div>

                {/* Step Content */}
                <div className="p-10">
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-black font-heading text-text-main flex items-center gap-3 uppercase tracking-tight">
                            <Globe className="text-indigo-500" size={24} /> Database Connection
                        </h2>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Link your Supabase and Groq API keys.</p>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Supabase URL</label>
                                <input
                                    type="text"
                                    value={config.supabase_url}
                                    onChange={e => setConfig({ ...config, supabase_url: e.target.value })}
                                    className="w-full p-4 bg-card-bg/40 border border-card-border rounded-2xl focus:border-indigo-500 outline-none font-bold text-text-main transition-all"
                                    placeholder="https://your-project.supabase.co"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Supabase Service Role Key</label>
                                <input
                                    type="password"
                                    value={config.supabase_key}
                                    onChange={e => setConfig({ ...config, supabase_key: e.target.value })}
                                    className="w-full p-4 bg-card-bg/40 border border-card-border rounded-2xl focus:border-indigo-500 outline-none font-bold text-text-main transition-all"
                                    placeholder="Enter your service role key..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Groq API Key (Optional)</label>
                                <input
                                    type="password"
                                    value={config.groq_api_key}
                                    onChange={e => setConfig({ ...config, groq_api_key: e.target.value })}
                                    className="w-full p-4 bg-card-bg/40 border border-card-border rounded-2xl focus:border-indigo-500 outline-none font-bold text-text-main transition-all"
                                    placeholder="gsk_..."
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveConfig}
                            disabled={isSaving}
                            className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} strokeWidth={3} />}
                            {isSaving ? "Authorizing..." : "Secure and Proceed"}
                        </button>
                        
                        <button onClick={() => navigate('/')} className="w-full text-center mt-4 text-[10px] font-black text-text-muted hover:text-indigo-500 uppercase tracking-[0.2em] transition-colors">
                            Skip to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSetup;

