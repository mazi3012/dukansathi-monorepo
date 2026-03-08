import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, HardDrive, Check, AlertTriangle, Save, Download, Server, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

const SystemSetup = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Hardware & Ollama
    const [hardware, setHardware] = useState(null);
    const [ollamaReady, setOllamaReady] = useState(false);
    const [ollamaLocalFound, setOllamaLocalFound] = useState(false);
    const [isCheckingOllama, setIsCheckingOllama] = useState(false);

    // Step 2: Config
    const [config, setConfig] = useState({
        SUPABASE_URL: '',
        SUPABASE_SERVICE_KEY: '',
        GROQ_API_KEY: ''
    });

    // Step 3: AI
    const [aiStatus, setAiStatus] = useState('idle'); // idle, pulling, done, error
    const [pullProgress, setPullProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const pollIntervalRef = useRef(null);

    const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
    const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

    // Cleanup polling interval on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        initSetup();
    }, []);

    const initSetup = async () => {
        setLoading(true);
        await checkHardware();
        await checkOllama();
        setLoading(false);
    };

    const checkHardware = async () => {
        try {
            console.log("🚀 Starting hardware scan at:", `${API_URL}/api/setup/hardware`);
            const res = await fetch(`${API_URL}/api/setup/hardware`);
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errorText}`);
            }
            const data = await res.json();
            console.log("✅ Hardware data received:", data);
            setHardware(data);
        } catch (err) {
            console.error("❌ Hardware check failed:", err);
            const msg = err.message === 'Failed to fetch'
                ? "Backend unreachable. Please run 'python main.py' in a terminal and ensure it stays open."
                : err.message;
            toast.error(msg);
            setHardware({ error: msg });
        }
    };

    const checkOllamaLocal = async () => {
        try {
            console.log("🚀 Checking local Ollama at: http://localhost:11434/api/tags");
            const res = await fetch("http://localhost:11434/api/tags", { mode: 'cors' });
            if (res.ok) {
                console.log("✅ Local Ollama detected!");
                setOllamaLocalFound(true);
                return true;
            }
        } catch (err) {
            console.warn("⚠️ Local Ollama not reachable directly via CORS.");
        }
        setOllamaLocalFound(false);
        return false;
    };

    const checkOllama = async () => {
        setIsCheckingOllama(true);
        try {
            // First check via backend
            console.log("🚀 Checking Ollama at:", `${API_URL}/api/setup/ollama-check`);
            const res = await fetch(`${API_URL}/api/setup/ollama-check`);
            const data = res.ok ? await res.json() : { is_running: false };

            let isReady = data.is_running;

            // If backend check fails (likely remote backend), try local check
            if (!isReady) {
                console.log("Backend check failed, trying local direct check...");
                isReady = await checkOllamaLocal();
            } else {
                setOllamaLocalFound(true);
            }

            console.log("✅ Final Ollama status:", isReady);
            setOllamaReady(isReady);

            if (!isReady) {
                toast.error("Ollama not detected! Ensure it is running locally.");
            }
        } catch (err) {
            console.error("❌ Ollama check failed:", err);
            // Final fallback to local
            const localFound = await checkOllamaLocal();
            setOllamaReady(localFound);
            if (!localFound) toast.error("Ollama Check Failed: " + err.message);
        } finally {
            setIsCheckingOllama(false);
        }
    };

    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/setup/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                toast.success("Configuration Saved!");
                setStep(3);
            } else {
                toast.error("Failed to save config");
            }
        } catch (err) {
            toast.error("Error saving config");
        } finally {
            setLoading(false);
        }
    };

    const pollPullStatus = () => {
        let retryCount = 0;
        const MAX_RETRIES = 60; // Stop after 2 minutes (60 * 2s)
        // Clear any previous interval
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(async () => {
            retryCount++;
            if (retryCount > MAX_RETRIES) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                setAiStatus('error');
                toast.error('Download timed out. Please check Ollama manually.');
                return;
            }
            try {
                const res = await fetch(`${API_URL}/api/setup/pull-status`);
                const data = await res.json();

                setPullProgress(data.progress || 0);
                if (data.logs) setLogs(data.logs);

                if (data.status === 'done') {
                    setAiStatus('done');
                    toast.success("AI Model Ready!");
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                } else if (data.status === 'error') {
                    setAiStatus('error');
                    toast.error(data.error || "Download failed");
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 2000);
        return pollIntervalRef.current;
    };

    const handleInstallAI = async () => {
        if (!hardware?.recommended_model) return;
        setAiStatus('pulling');
        setLogs([`Requesting ${hardware.recommended_model}...`]);

        try {
            const res = await fetch(`${API_URL}/api/setup/install-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_name: hardware.recommended_model })
            });

            if (res.ok) {
                pollPullStatus();
            } else {
                const err = await res.json();
                setAiStatus('error');
                setLogs(prev => [...prev, `Error: ${err.detail || 'Failed to start'}`]);
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

            <div className="max-w-2xl w-full glass-card rounded-[48px] border border-card-border shadow-2xl overflow-hidden relative z-10">
                {/* Header - Streamlined */}
                <div className="p-10 border-b border-card-border/50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                    <div className="flex items-center gap-6 mb-8">
                        <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-2xl shadow-indigo-500/5 transition-transform hover:rotate-12">
                            <Server size={40} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Neural Sync</h1>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em] mt-2 transition-colors">System Initialization Protocol v2.6</p>
                        </div>
                    </div>

                    {/* Progress - AI Styled */}
                    <div className="flex items-center gap-4 mt-10">
                        {[1, 2, 3].map((s) => (
                            <React.Fragment key={s}>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-500 ${step >= s ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 ring-4 ring-indigo-500/10' : 'bg-card-bg/50 text-text-muted border border-card-border'}`}>
                                    {step > s ? <Check size={20} strokeWidth={3} /> : s}
                                </div>
                                {s < 3 && <div className={`h-1 flex-1 rounded-full transition-all duration-700 ${step > s ? 'bg-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-card-border'}`}></div>}
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-text-muted uppercase tracking-[0.2em] mt-3 px-1">
                        <span>Hardware Scan</span>
                        <span>Config Handshake</span>
                        <span>AI Engine Build</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-10">
                    {/* STEP 1: HARDWARE */}
                    {step === 1 && (
                        <div className="space-y-8">
                            <h2 className="text-2xl font-black font-heading text-text-main flex items-center gap-3 uppercase tracking-tight">
                                <Cpu className="text-indigo-500" size={24} /> Hardware Diagnostics
                            </h2>

                            {loading && <div className="text-center py-12 font-black text-text-muted animate-pulse uppercase tracking-[0.3em]">Scrutinizing System Architecture...</div>}

                            {hardware && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="bg-card-bg/40 p-5 rounded-3xl border border-card-border transition-colors hover:border-indigo-500/50">
                                            <div className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-2">Central Processor</div>
                                            <div className="font-bold text-text-main truncate" title={hardware.cpu}>{hardware.cpu || "Analyzing..."}</div>
                                        </div>
                                        <div className="bg-card-bg/40 p-5 rounded-3xl border border-card-border transition-colors hover:border-indigo-500/50">
                                            <div className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-2">Graphics Engine</div>
                                            <div className="font-bold text-text-main truncate">{hardware.gpu || "Unified Graphics"}</div>
                                        </div>
                                        <div className="bg-card-bg/40 p-5 rounded-3xl border border-card-border transition-colors hover:border-indigo-500/50">
                                            <div className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-2">System Memory</div>
                                            <div className="font-bold text-text-main">{hardware.ram_total_gb ? `${hardware.ram_total_gb} GB DDR` : 'Analyzing...'}</div>
                                        </div>
                                        <div className="bg-card-bg/40 p-5 rounded-3xl border border-card-border transition-colors hover:border-indigo-500/50">
                                            <div className="text-[9px] text-text-muted uppercase font-black tracking-widest mb-2">Neural VRAM</div>
                                            <div className="font-bold text-text-main">{hardware.vram_gb !== undefined ? `${hardware.vram_gb} GB` : 'Analyzing...'}</div>
                                        </div>
                                    </div>

                                    {hardware.error && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                            Diagnostic Fault: {hardware.error}
                                        </div>
                                    )}

                                    <div className={`p-6 rounded-3xl border transition-all ${ollamaReady ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/5 border-amber-500/20 text-amber-500'}`}>
                                        <div className="flex items-start gap-4">
                                            {ollamaReady ? <Check size={24} className="mt-1" /> : <AlertTriangle className="mt-1" size={24} />}
                                            <div className="flex-1">
                                                <div className="font-black uppercase tracking-tight flex items-center justify-between">
                                                    <span>Ollama Engine: {ollamaReady ? "Bridged" : "Not Detected"}</span>
                                                    <button onClick={checkOllama} className="text-[9px] underline uppercase tracking-widest disabled:opacity-50" disabled={isCheckingOllama}>
                                                        {isCheckingOllama ? "Checking..." : "Re-Scan"}
                                                    </button>
                                                </div>
                                                <div className="text-[11px] font-bold opacity-80 mt-2 leading-relaxed">
                                                    {ollamaReady
                                                        ? ollamaLocalFound
                                                            ? `Optimal Model for your hardware: ${hardware.recommended_model}`
                                                            : `Remote Backend active. Local Ollama detected via direct bridge.`
                                                        : "Ollama is the core neural runtime for local AI. Please install it from ollama.com, set OLLAMA_ORIGINS=\"*\" (if using cloud backend), and ensure the service is active."}
                                                </div>
                                                {!ollamaReady && (
                                                    <div className="flex flex-col gap-3 mt-4">
                                                        <a href="https://ollama.com" target="_blank" rel="noreferrer" className="inline-block px-6 py-2 bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-center hover:bg-amber-500 hover:text-white transition-all">
                                                            Deploy Ollama Runtime
                                                        </a>
                                                        <p className="text-[9px] font-black opacity-60">
                                                            PRO TIP: If backend is remote, run: <code className="bg-black/20 p-1 rounded">set OLLAMA_ORIGINS="*"</code> before starting Ollama.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!ollamaReady}
                                        className={`w-full py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-[10px] ${ollamaReady ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98]' : 'bg-card-bg/40 text-text-muted border border-card-border cursor-not-allowed'}`}
                                    >
                                        Authorize Config <ArrowRight size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: CONFIG */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-black font-heading text-text-main flex items-center gap-3 uppercase tracking-tight">
                                <Server className="text-indigo-500" size={24} /> Environment Handshake
                            </h2>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-relaxed">
                                Link your cloud neural nodes. Credentials will be stored in an encrypted local env layer.
                            </p>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Supabase Endpoint</label>
                                    <input
                                        value={config.SUPABASE_URL}
                                        onChange={e => setConfig({ ...config, SUPABASE_URL: e.target.value })}
                                        className="w-full p-4 bg-card-bg/40 border border-card-border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-text-main transition-all"
                                        placeholder="https://xyz.supabase.co"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Secure Service Key</label>
                                    <input
                                        type="password"
                                        value={config.SUPABASE_SERVICE_KEY}
                                        onChange={e => setConfig({ ...config, SUPABASE_SERVICE_KEY: e.target.value })}
                                        className="w-full p-4 bg-card-bg/40 border border-card-border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-text-main transition-all"
                                        placeholder="eyJhbGci..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Groq Accelerator Key (Opt.)</label>
                                    <input
                                        type="password"
                                        value={config.GROQ_API_KEY}
                                        onChange={e => setConfig({ ...config, GROQ_API_KEY: e.target.value })}
                                        className="w-full p-4 bg-card-bg/40 border border-card-border rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-text-main transition-all"
                                        placeholder="gsk_..."
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveConfig}
                                disabled={loading}
                                className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
                            >
                                {loading ? "Committing..." : <><Save size={18} strokeWidth={3} /> Save and Deploy</>}
                            </button>
                        </div>
                    )}

                    {/* STEP 3: AI INSTALL */}
                    {step === 3 && (
                        <div className="space-y-8">
                            <h2 className="text-2xl font-black font-heading text-text-main flex items-center gap-3 uppercase tracking-tight">
                                <Download className="text-indigo-500" size={24} /> Neural Engine Build
                            </h2>

                            <div className="bg-slate-950 text-indigo-400 p-6 rounded-3xl font-mono text-[11px] h-56 overflow-y-auto mb-2 custom-scrollbar shadow-2xl border border-indigo-500/20">
                                <div className="opacity-60 mb-2"># Initializing Local LLM Deployment</div>
                                <div className="opacity-60 mb-2"># Target Architecture: {hardware?.recommended_model}</div>
                                {logs.map((log, i) => <div key={i} className="flex gap-2 mb-1">
                                    <span className="text-indigo-500/40 font-black">&gt;&gt;</span>
                                    <span className="text-indigo-100">{log}</span>
                                </div>)}
                                {aiStatus === 'pulling' && <div className="animate-pulse text-indigo-400 mt-2 font-black">&gt;&gt; DEPLOYING NEURAL WEIGHTS... {pullProgress}%</div>}
                            </div>

                            {aiStatus === 'pulling' && (
                                <div className="w-full h-2 bg-indigo-500/10 rounded-full overflow-hidden mb-4">
                                    <div
                                        className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-300 ease-out"
                                        style={{ width: `${pullProgress}%` }}
                                    />
                                </div>
                            )}

                            {(aiStatus === 'idle' || aiStatus === 'error') && (
                                <button
                                    onClick={handleInstallAI}
                                    className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
                                >
                                    <Download size={18} strokeWidth={3} /> {aiStatus === 'error' ? 'Re-Initiate Build' : `Deploy ${hardware?.recommended_model}`}
                                </button>
                            )}

                            {aiStatus === 'done' && (
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
                                >
                                    Activate Neural Interface <ArrowRight size={18} strokeWidth={3} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemSetup;
