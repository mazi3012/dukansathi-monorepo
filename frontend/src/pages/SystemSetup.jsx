import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Cpu,
    HardDrive,
    Check,
    AlertTriangle,
    Save,
    Download,
    Server,
    ArrowRight,
    ShieldCheck,
    Smartphone,
    Monitor,
    Globe,
    Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getDB, initSQLite } from '../lib/sqlite';
import { syncEngine } from '../lib/db/syncEngine';

const SystemSetup = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Core hardware and AI states
    const [hardware, setHardware] = useState(null);
    const [ollamaRunning, setOllamaRunning] = useState(false);
    const [isPWA, setIsPWA] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Config states
    const [config, setConfig] = useState({
        supabase_url: localStorage.getItem('supabase_url') || '',
        supabase_key: localStorage.getItem('supabase_key') || '',
        groq_api_key: localStorage.getItem('groq_api_key') || ''
    });

    // AI Install States
    const [aiStatus, setAiStatus] = useState('idle'); // idle, pulling, done, error
    const [pullProgress, setPullProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const pollIntervalRef = useRef(null);

    const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
    const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

    useEffect(() => {
        // Simple PWA & Environment check
        setIsPWA(window.matchMedia('(display-mode: standalone)').matches);
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

        const performDiagnostics = async () => {
            setLoading(true);
            try {
                // 1. Hardware Check
                const diagRes = await fetch(`${API_URL}/api/setup/hardware`).catch(() => null);
                if (diagRes && diagRes.ok) {
                    setHardware(await diagRes.json());
                }

                // 2. Ollama Check
                const ollamaRes = await fetch(`${API_URL}/api/setup/ollama-check`).catch(() => null);
                if (ollamaRes && ollamaRes.ok) {
                    const data = await ollamaRes.json();
                    setOllamaRunning(data.is_running);
                }
            } catch (e) {
                console.warn("Diagnostics connectivity issue", e);
            } finally {
                setLoading(false);
            }
        };

        performDiagnostics();

        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [API_URL]);

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
                setStep(3);
            }
        } catch (err) {
            toast.error("Failed to save config");
        } finally {
            setIsSaving(false);
        }
    };

    const pollPullStatus = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/setup/pull-status`);
                const data = await res.json();

                setPullProgress(data.progress || 0);
                if (data.logs) setLogs(data.logs);

                if (data.status === 'done') {
                    setAiStatus('done');
                    toast.success("AI Neural Weights Deployed!");
                    clearInterval(pollIntervalRef.current);
                } else if (data.status === 'error') {
                    setAiStatus('error');
                    toast.error(data.error || "Deployment failed");
                    clearInterval(pollIntervalRef.current);
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 2000);
    };

    const handleInstallAI = async () => {
        if (!hardware?.recommended_model) return;
        setAiStatus('pulling');
        setLogs([`Requesting ${hardware.recommended_model} from distribution nodes...`]);

        try {
            const res = await fetch(`${API_URL}/api/setup/install-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_name: hardware.recommended_model })
            });

            if (res.ok) {
                pollPullStatus();
            } else {
                setAiStatus('error');
            }
        } catch (err) {
            setAiStatus('error');
            setLogs(prev => [...prev, `Connection Error: ${err.message}`]);
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
                    <div className="flex items-center gap-6 mb-8">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/5 transition-transform hover:rotate-6">
                            <Server size={40} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Neural Sync</h1>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em] mt-2 transition-colors">System Initialization Protocol v3.0</p>
                        </div>
                    </div>

                    {/* Simple Step Meter */}
                    <div className="flex items-center gap-4 mt-8">
                        {[1, 2, 3].map((s) => (
                            <React.Fragment key={s}>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-500 ${step >= s ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 ring-4 ring-indigo-500/10' : 'bg-card-bg/50 text-text-muted border border-card-border'}`}>
                                    {step > s ? <Check size={20} /> : s}
                                </div>
                                {s < 3 && <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${step > s ? 'bg-indigo-600' : 'bg-card-border'}`}></div>}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="p-10">
                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-2xl font-black font-heading text-text-main flex items-center gap-3 uppercase tracking-tight">
                                    <Cpu className="text-indigo-500" size={24} /> Hardware Scan
                                </h2>
                                {isPWA && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">PWA Active</span>}
                            </div>

                            {loading ? (
                                <div className="text-center py-12 flex flex-col items-center gap-4">
                                    <Loader2 size={40} className="text-indigo-500 animate-spin" />
                                    <p className="font-black text-text-muted uppercase tracking-widest text-xs">Parsing System Architecture...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-card-bg/40 p-5 rounded-3xl border border-card-border">
                                            <div className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-2">Central Node</div>
                                            <div className="font-bold text-text-main truncate text-sm">{hardware?.cpu || "Standard Chipset"}</div>
                                        </div>
                                        <div className="bg-card-bg/40 p-5 rounded-3xl border border-card-border">
                                            <div className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-2">Memory Matrix</div>
                                            <div className="font-bold text-text-main text-sm">{hardware?.ram_total_gb ? `${hardware.ram_total_gb} GB DDR` : 'Analyzing...'}</div>
                                        </div>
                                    </div>

                                    <div className={`p-6 rounded-3xl border transition-all ${ollamaRunning ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-purple-500/5 border-purple-500/20 text-purple-500'}`}>
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-2xl ${ollamaRunning ? 'bg-emerald-500/10' : 'bg-purple-500/10'}`}>
                                                {ollamaRunning ? <ShieldCheck size={24} /> : <HardDrive size={24} />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-black uppercase tracking-tight mb-1 text-sm">Local Engine: {ollamaRunning ? "Connected" : "Standby"}</div>
                                                <p className="text-[11px] font-bold opacity-80 leading-relaxed">
                                                    {ollamaRunning
                                                        ? `Neural acceleration active. Optimal model detected: ${hardware?.recommended_model || 'Gemma 2B'}`
                                                        : "Local AI requires Ollama. For 100% private, offline intelligence, install Ollama from ollama.com."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {isMobile && (
                                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 text-amber-500 rounded-2xl flex items-center gap-3">
                                            <Smartphone size={20} />
                                            <p className="text-[10px] font-black uppercase tracking-widest">Mobile Detection: Optimizing for Cloud Intelligence</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setStep(2)}
                                        className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
                                    >
                                        Proceed to Configuration <ArrowRight size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-2xl font-black font-heading text-text-main flex items-center gap-3 uppercase tracking-tight">
                                <Globe className="text-indigo-500" size={24} /> Cloud Handshake
                            </h2>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Link your decentralized storage and auxiliary AI nodes.</p>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Supabase Endpoint</label>
                                    <input
                                        type="text"
                                        value={config.supabase_url}
                                        onChange={e => setConfig({ ...config, supabase_url: e.target.value })}
                                        className="w-full p-4 bg-card-bg/40 border border-card-border rounded-2xl focus:border-indigo-500 outline-none font-bold text-text-main transition-all"
                                        placeholder="https://your-project.supabase.co"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Secure Service Key</label>
                                    <input
                                        type="password"
                                        value={config.supabase_key}
                                        onChange={e => setConfig({ ...config, supabase_key: e.target.value })}
                                        className="w-full p-4 bg-card-bg/40 border border-card-border rounded-2xl focus:border-indigo-500 outline-none font-bold text-text-main transition-all"
                                        placeholder="Enter your service role key..."
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Groq Accelerator (Optional)</label>
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
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-2xl font-black font-heading text-text-main flex items-center gap-3 uppercase tracking-tight">
                                <Download className="text-indigo-500" size={24} /> Intelligence Forge
                            </h2>

                            <div className="bg-slate-950 p-6 rounded-[32px] border border-indigo-500/20 font-mono text-[11px] h-52 overflow-y-auto custom-scrollbar shadow-2xl">
                                <div className="text-indigo-500 font-bold mb-2">&gt;&gt; Initializing Local Deployment</div>
                                {logs.map((log, i) => (
                                    <div key={i} className="text-indigo-100/70 mb-1 flex gap-2">
                                        <span className="text-indigo-500">&gt;</span> {log}
                                    </div>
                                ))}
                                {aiStatus === 'pulling' && (
                                    <div className="text-indigo-400 font-black animate-pulse mt-4">
                                        &gt; DEPLOYING NEURAL WEIGHTS: {pullProgress}%
                                    </div>
                                )}
                            </div>

                            {aiStatus === 'pulling' && (
                                <div className="w-full h-1.5 bg-indigo-500/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${pullProgress}%` }} />
                                </div>
                            )}

                            <div className="flex flex-col gap-4">
                                {aiStatus !== 'done' ? (
                                    <button
                                        onClick={handleInstallAI}
                                        disabled={aiStatus === 'pulling' || !ollamaRunning}
                                        className={`w-full py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] ${ollamaRunning ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.02]' : 'bg-card-bg text-text-muted opacity-50 cursor-not-allowed'}`}
                                    >
                                        <Download size={18} />
                                        {aiStatus === 'pulling' ? 'Deploying Weights...' : `Deploy ${hardware?.recommended_model || 'Local Model'}`}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate('/')}
                                        className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
                                    >
                                        Activate Neural Interface <ArrowRight size={18} />
                                    </button>
                                )}

                                {aiStatus !== 'done' && (
                                    <button onClick={() => navigate('/')} className="text-[10px] font-black text-text-muted hover:text-indigo-500 uppercase tracking-[0.2em] transition-colors">
                                        Skip to Dashboard
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <p className="mt-8 text-[9px] font-black text-text-muted uppercase tracking-[0.4em] opacity-40">
                PWA Core Security • End-to-End Encryption • Offline-First Logic
            </p>
        </div>
    );
};

export default SystemSetup;
