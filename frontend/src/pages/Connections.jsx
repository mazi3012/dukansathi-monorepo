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
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="bg-white p-4 border-b border-slate-100 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center text-sky-500">
                        <Send size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Connections</h1>
                        <p className="text-xs text-slate-500">Link your channels to Dukan Sathi</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24">
                {/* ── Telegram Connect Section ─────────── */}
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 overflow-hidden relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500" />
                    <div className="flex items-center gap-2 mb-1 mt-1">
                        <Send className="text-sky-500" size={20} />
                        <h2 className="font-semibold text-slate-800">Connect Telegram</h2>
                        {telegramConnected && (
                            <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={12} /> Connected
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 mb-5 mt-2">
                        Chat with Sathi AI, add products, and create invoices right from Telegram. Secure and fast.
                    </p>

                    {checking ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="animate-spin text-sky-500" size={24} />
                        </div>
                    ) : telegramConnected ? (
                        <div className="flex flex-col items-center gap-4 py-6 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 className="text-emerald-500" size={32} />
                            </div>
                            <p className="text-base font-semibold text-slate-700">Your account is linked to Telegram!</p>
                            <a
                                href={`https://t.me/${BOT_USERNAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all shadow-sm transform hover:-translate-y-0.5"
                            >
                                <Send size={18} /> Open @{BOT_USERNAME}
                            </a>
                        </div>
                    ) : waitingForBot ? (
                        <div className="flex flex-col items-center gap-4 py-8 bg-slate-50 rounded-xl border border-slate-100 text-center">
                            <Loader2 className="animate-spin text-sky-500" size={36} />
                            <p className="text-base font-semibold text-slate-700">
                                Waiting for you to click "Start" in Telegram...
                            </p>
                            <p className="text-sm text-slate-500 max-w-sm">
                                Did the app not open? <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer" className="text-sky-600 underline font-medium hover:text-sky-700">Click here to open it manually</a>
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-6 bg-slate-50 rounded-xl border border-slate-100">
                            <button
                                onClick={generateTelegramCode}
                                disabled={generatingCode}
                                className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-sm text-base transform hover:-translate-y-0.5"
                            >
                                {generatingCode
                                    ? <><Loader2 size={18} className="animate-spin" /> Preparing...</>
                                    : <><Send size={18} /> Securely Connect to Telegram</>}
                            </button>
                            <p className="text-xs text-slate-500 max-w-sm text-center">
                                Clicking this button will securely link your account. It will open the Telegram app automatically.
                            </p>
                        </div>
                    )}
                </section>

                {/* ── WhatsApp Connect Section (Coming Soon) ─────────── */}
                <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 overflow-hidden relative opacity-75">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
                    <div className="absolute top-4 right-4 bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        Coming Soon
                    </div>

                    <div className="flex items-center gap-2 mb-1 mt-1">
                        <MessageCircle className="text-emerald-500" size={20} />
                        <h2 className="font-semibold text-slate-800">Connect WhatsApp</h2>
                    </div>
                    <p className="text-sm text-slate-500 mb-5 mt-2">
                        Get business updates, manage inventory, and receive payments through official WhatsApp integration.
                    </p>

                    <div className="flex flex-col items-center gap-3 py-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                        <MessageCircle size={32} className="text-slate-300" />
                        <p className="text-sm font-medium text-slate-500">WhatsApp integration is currently under development</p>
                        <button disabled className="bg-slate-200 text-slate-400 px-6 py-2 rounded-xl text-sm font-semibold cursor-not-allowed mt-2">
                            Connect WhatsApp
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Connections;
