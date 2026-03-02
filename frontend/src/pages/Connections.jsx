import React, { useState, useEffect, useRef } from 'react';
import { Send, CheckCircle2, Loader2, MessageCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BOT_USERNAME = 'SathiAibot';

const Connections = () => {
    const [telegramConnected, setTelegramConnected] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [waitingForBot, setWaitingForBot] = useState(false);
    const [checking, setChecking] = useState(true);
    const timerRef = useRef(null);

    // Check if Telegram is already connected for this user
    const checkTelegramConnection = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { data } = await supabase
                .from('telegram_users')
                .select('user_id')
                .eq('user_id', session.user.id)
                .limit(1)
                .maybeSingle();
            if (data) setTelegramConnected(true);
        } catch {
            // Not connected — ignore
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        checkTelegramConnection();
    }, []);

    // Polling connection status when waiting for bot
    useEffect(() => {
        if (!waitingForBot || telegramConnected) return;
        timerRef.current = setInterval(() => {
            checkTelegramConnection();
        }, 3000);
        return () => clearInterval(timerRef.current);
    }, [waitingForBot, telegramConnected]);

    const generateTelegramCode = async () => {
        setGeneratingCode(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Generate a secure UUID token
            const token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

            // Insert directly into Supabase (Frontend bypasses backend completely!)
            const { error } = await supabase.from('telegram_connect_tokens').insert({
                user_id: session.user.id,
                token: token,
                expires_at: expiresAt,
                used: false
            });

            if (error) throw error;

            // Redirect to Telegram Deep Link
            setWaitingForBot(true);
            window.open(`https://t.me/${BOT_USERNAME}?start=${token}`, '_blank');

        } catch (e) {
            console.error('Failed to generate Telegram link:', e);
            alert("Could not generate secure link. Check your internet connection.");
        } finally {
            setGeneratingCode(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-bg-main relative overflow-hidden transition-colors">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Page Title Section - Streamlined */}
            <header className="flex flex-col md:flex-row md:items-end justify-between px-6 pt-6 gap-6 relative z-20">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-[22px] bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 shadow-xl shadow-sky-500/5 transition-transform hover:scale-110">
                        <Send size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black font-heading text-text-main tracking-tighter leading-tight transition-colors">Neural Sync</h1>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mt-1 transition-colors">Channel & Gateway Protocols</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24">
                {/* ── Telegram Connect Section ─────────── */}
                <section className="glass-card rounded-[40px] p-8 border border-card-border shadow-2xl overflow-hidden relative group">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500 opacity-50" />
                    <div className="flex items-center gap-3 mb-2">
                        <Send className="text-sky-500" size={24} />
                        <h2 className="text-2xl font-black font-heading text-text-main tracking-tight uppercase">Telegram Neural Node</h2>
                        {telegramConnected && (
                            <span className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                                <CheckCircle2 size={12} /> Live Link
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-8 mt-2 max-w-lg transition-colors">
                        Deploy Sathi AI into your Telegram ecosystem. Secure, end-to-end encrypted protocol.
                    </p>

                    {checking ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin text-sky-500" size={32} />
                        </div>
                    ) : telegramConnected ? (
                        <div className="flex flex-col items-center gap-6 py-10 bg-sky-500/5 rounded-[32px] border border-sky-500/20">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <CheckCircle2 className="text-emerald-500" size={40} />
                            </div>
                            <p className="text-base font-black text-text-main uppercase tracking-tight">Channel Handshake Successful</p>
                            <a
                                href={`https://t.me/${BOT_USERNAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 bg-sky-500 text-white text-[10px] font-black uppercase tracking-widest px-8 py-4 rounded-2xl transition-all shadow-xl shadow-sky-500/20 hover:scale-105 active:scale-95"
                            >
                                <Send size={18} strokeWidth={3} /> Launch @{BOT_USERNAME}
                            </a>
                        </div>
                    ) : waitingForBot ? (
                        <div className="flex flex-col items-center gap-6 py-10 bg-sky-500/5 rounded-[32px] border border-sky-500/20 text-center">
                            <Loader2 className="animate-spin text-sky-500" size={48} />
                            <p className="text-base font-black text-text-main uppercase tracking-tight">
                                Awaiting First Contact (Start)
                            </p>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest max-w-xs">
                                Did the gateway not bridge? <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer" className="text-sky-500 underline hover:text-sky-400">Manual Override Link</a>
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6 py-10 bg-sky-500/5 rounded-[32px] border border-sky-500/20">
                            <button
                                onClick={generateTelegramCode}
                                disabled={generatingCode}
                                className="flex items-center justify-center gap-3 bg-sky-500 disabled:opacity-60 text-white font-black px-10 py-5 rounded-2xl transition-all shadow-xl shadow-sky-500/20 text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {generatingCode
                                    ? <><Loader2 size={18} className="animate-spin" /> Sequencing...</>
                                    : <><Send size={18} strokeWidth={3} /> Secure Connection Request</>}
                            </button>
                            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest max-w-xs text-center">
                                Bridge request will expire in 600s. Protocol V2 Secure.
                            </p>
                        </div>
                    )}
                </section>

                {/* ── WhatsApp Connect Section (Coming Soon) ─────────── */}
                <section className="glass-card rounded-[40px] p-8 border border-card-border shadow-2xl overflow-hidden relative opacity-60 grayscale group">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-green-500 opacity-30" />
                    <div className="absolute top-6 right-8 bg-card-bg/50 text-text-muted px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border border-card-border">
                        Locked: R&D
                    </div>

                    <div className="flex items-center gap-3 mb-2">
                        <MessageCircle className="text-emerald-500" size={24} />
                        <h2 className="text-2xl font-black font-heading text-text-main tracking-tight uppercase">Meta WhatsApp Node</h2>
                    </div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-8 mt-2 max-w-lg transition-colors">
                        Enterprise-grade integration for mass communication and automated logistics.
                    </p>

                    <div className="flex flex-col items-center gap-4 py-10 bg-emerald-500/5 rounded-[32px] border border-emerald-500/20 border-dashed">
                        <MessageCircle size={48} className="text-text-muted/20" />
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Neural Link Offline • Awaiting API Access</p>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Connections;
