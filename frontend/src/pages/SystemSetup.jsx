import React, { useState, useEffect } from 'react';
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

    const API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';

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

    const checkOllama = async () => {
        setIsCheckingOllama(true);
        try {
            console.log("🚀 Checking Ollama at:", `${API_URL}/api/setup/ollama-check`);
            const res = await fetch(`${API_URL}/api/setup/ollama-check`);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            const data = await res.json();
            console.log("✅ Ollama status response:", data);
            setOllamaReady(data.is_running);
            if (!data.is_running) {
                console.warn("⚠️ Backend reports Ollama not reachable.");
            }
        } catch (err) {
            console.error("❌ Ollama check failed:", err);
            setOllamaReady(false);
            toast.error("Ollama Check Failed: " + err.message);
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
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/setup/pull-status`);
                const data = await res.json();

                setPullProgress(data.progress || 0);
                if (data.logs) setLogs(data.logs);

                if (data.status === 'done') {
                    setAiStatus('done');
                    toast.success("AI Model Ready!");
                    clearInterval(interval);
                } else if (data.status === 'error') {
                    setAiStatus('error');
                    toast.error(data.error || "Download failed");
                    clearInterval(interval);
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 2000);
        return interval;
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
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-600 p-6 text-white">
                    <h1 className="text-2xl font-bold mb-2">System Setup Wizard</h1>
                    <p className="opacity-90">Configure your local Dukan Sathi environment</p>

                    {/* Progress */}
                    <div className="flex items-center gap-2 mt-6 text-sm font-medium">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-white text-indigo-600' : 'bg-indigo-500 text-indigo-200'}`}>1</div>
                        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-white' : 'bg-indigo-500'}`}></div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-white text-indigo-600' : 'bg-indigo-500 text-indigo-200'}`}>2</div>
                        <div className={`h-1 flex-1 rounded-full ${step >= 3 ? 'bg-white' : 'bg-indigo-500'}`}></div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-white text-indigo-600' : 'bg-indigo-500 text-indigo-200'}`}>3</div>
                    </div>
                    <div className="flex justify-between text-xs mt-1 px-1">
                        <span>Hardware</span>
                        <span>Config</span>
                        <span>AI Engine</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8">
                    {/* STEP 1: HARDWARE */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Cpu className="text-indigo-600" /> System Hardware Check
                            </h2>

                            {loading && <div className="text-center py-8">Scanning system...</div>}

                            {hardware && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Processor</div>
                                            <div className="font-medium text-slate-800 truncate" title={hardware.cpu}>{hardware.cpu || "Detecting..."}</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Graphics</div>
                                            <div className="font-medium text-slate-800 truncate">{hardware.gpu || "Integrated"}</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">RAM</div>
                                            <div className="font-medium text-slate-800">{hardware.ram_total_gb ? `${hardware.ram_total_gb} GB` : 'Detecting...'}</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">VRAM</div>
                                            <div className="font-medium text-slate-800">{hardware.vram_gb !== undefined ? `${hardware.vram_gb} GB` : 'Detecting...'}</div>
                                        </div>
                                    </div>

                                    {hardware.error && (
                                        <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-mono">
                                            Hardware Error: {hardware.error}
                                        </div>
                                    )}

                                    {/* Ollama Status */}
                                    <div className={`p-4 rounded-xl border ${ollamaReady ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                                        <div className="flex items-start gap-3">
                                            {ollamaReady ? <Check className="mt-1" /> : <AlertTriangle className="mt-1" />}
                                            <div className="flex-1">
                                                <div className="font-bold flex items-center justify-between">
                                                    <span>Ollama Engine: {ollamaReady ? "Running" : "Not Found"}</span>
                                                    {!ollamaReady && <button onClick={checkOllama} className="text-xs underline flex items-center gap-1">Check Again</button>}
                                                </div>
                                                <div className="text-sm opacity-90 mt-1">
                                                    {ollamaReady
                                                        ? `Recommended Model: ${hardware.recommended_model}`
                                                        : "Ollama is required for local AI. Please install it from ollama.com and keep it running."}
                                                </div>
                                                {!ollamaReady && (
                                                    <a href="https://ollama.com" target="_blank" rel="noreferrer" className="inline-block mt-3 px-4 py-1.5 bg-amber-200 text-amber-900 rounded-lg text-sm font-bold hover:bg-amber-300 transition">
                                                        Download Ollama
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!ollamaReady}
                                        className={`w-full py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 ${ollamaReady ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                    >
                                        Next: Configuration <ArrowRight size={20} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: CONFIG */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Server className="text-indigo-600" /> Environment Config
                            </h2>
                            <p className="text-sm text-slate-500">
                                Enter your API credentials. These will be saved to your local .env file.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Supabase URL</label>
                                    <input
                                        value={config.SUPABASE_URL}
                                        onChange={e => setConfig({ ...config, SUPABASE_URL: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="https://xyz.supabase.co"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Supabase Service Key</label>
                                    <input
                                        type="password"
                                        value={config.SUPABASE_SERVICE_KEY}
                                        onChange={e => setConfig({ ...config, SUPABASE_SERVICE_KEY: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="eyJhbGci..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Groq API Key (Optional)</label>
                                    <input
                                        type="password"
                                        value={config.GROQ_API_KEY}
                                        onChange={e => setConfig({ ...config, GROQ_API_KEY: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="gsk_..."
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveConfig}
                                disabled={loading}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                            >
                                {loading ? "Saving..." : <><Save size={20} /> Save & Continue</>}
                            </button>
                        </div>
                    )}

                    {/* STEP 3: AI INSTALL */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Download className="text-indigo-600" /> Install Local AI Engine
                            </h2>

                            <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-sm h-48 overflow-y-auto mb-2 custom-scrollbar shadow-inner">
                                <div className="text-indigo-400"># System ready. target: {hardware?.recommended_model}</div>
                                {logs.map((log, i) => <div key={i} className="flex gap-2">
                                    <span className="text-slate-500">&gt;</span>
                                    <span>{log}</span>
                                </div>)}
                                {aiStatus === 'pulling' && <div className="animate-pulse text-indigo-300">&gt; Downloading... {pullProgress}%</div>}
                            </div>

                            {aiStatus === 'pulling' && (
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
                                    <div
                                        className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                                        style={{ width: `${pullProgress}%` }}
                                    />
                                </div>
                            )}

                            {(aiStatus === 'idle' || aiStatus === 'error') && (
                                <button
                                    onClick={handleInstallAI}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Download size={20} /> {aiStatus === 'error' ? 'Retry Installation' : `Install ${hardware?.recommended_model}`}
                                </button>
                            )}

                            {aiStatus === 'done' && (
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-lg"
                                >
                                    Launch Dukan Sathi <ArrowRight size={20} />
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
