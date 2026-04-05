import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, ShoppingBag, Star, CheckCircle2, ArrowRight, Coins } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

// ── Credit Pack Definitions (must match backend CREDIT_PACKS) ──────────
const CREDIT_PACKS = [
    {
        id: 'micro',
        name: 'Micro-Topup',
        price: '₹49',
        credits: 200,
        icon: Zap,
        color: 'sky',
        gradient: 'from-sky-500 to-cyan-500',
        tagline: 'Running low? Quick refill!',
        perBill: '₹0.24 / bill',
        popular: false,
    },
    {
        id: 'small',
        name: 'Small Shop',
        price: '₹99',
        credits: 500,
        icon: ShoppingBag,
        color: 'indigo',
        gradient: 'from-indigo-500 to-violet-500',
        tagline: 'Perfect for free plan users',
        perBill: '₹0.20 / bill',
        popular: false,
    },
    {
        id: 'business',
        name: 'Business Boost',
        price: '₹249',
        credits: 2000,
        icon: TrendingUp,
        color: 'purple',
        gradient: 'from-purple-500 to-pink-500',
        tagline: 'Best value for busy months',
        perBill: '₹0.12 / bill',
        popular: true,
    },
    {
        id: 'retail',
        name: 'Retail King',
        price: '₹999',
        credits: 10000,
        icon: Star,
        color: 'amber',
        gradient: 'from-amber-500 to-orange-500',
        tagline: 'Festival season power pack',
        perBill: '₹0.10 / bill',
        popular: false,
    },
];

// ── Credit Cost Reference ─────────────────────────────────────────────
const CREDIT_COSTS = [
    { action: 'Generate a Bill', cost: 1, icon: '🧾' },
    { action: 'AI Chat Message', cost: 2, icon: '💬' },
    { action: 'Voice-to-Bill',   cost: 5, icon: '🎙️' },
    { action: 'Add Product',     cost: 0, icon: '📦' },
    { action: 'Add Customer',    cost: 0, icon: '👤' },
];

export default function Credits() {
    const { creditBalance, refreshCredits, tier } = useSubscription();
    const [loading, setLoading] = useState(null);

    const handleBuyPack = async (pack) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { toast.error('Please log in first.'); return; }

        const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
        const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

        setLoading(pack.id);
        try {
            // 1. Create Razorpay Order
            const orderRes = await fetch(`${API_URL}/api/credits/order`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pack_id: pack.id }),
            });
            if (!orderRes.ok) throw new Error('Failed to create order');
            const order = await orderRes.json();

            // 2. Ensure Razorpay SDK loaded
            await new Promise((resolve, reject) => {
                if (typeof window.Razorpay === 'function') { resolve(); return; }
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
                document.head.appendChild(script);
            });

            const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
            if (!rzpKey) throw new Error('Payment system not configured');

            // 3. Open Razorpay Checkout
            const rzp = new window.Razorpay({
                key: rzpKey,
                order_id: order.order_id,
                amount: order.amount,
                currency: order.currency,
                name: 'Dukan Sathi AI',
                description: `${pack.credits} AI Credits`,
                image: '/logo.svg',
                prefill: {
                    email: session.user.email,
                    name: session.user.user_metadata?.full_name || '',
                },
                theme: { color: '#6366f1' },
                handler: async (response) => {
                    const toastId = toast.loading('Adding credits to your account...');
                    try {
                        const { data: { session: freshSession } } = await supabase.auth.getSession();
                        const verifyRes = await fetch(`${API_URL}/api/credits/verify`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${freshSession.access_token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                razorpay_order_id:   response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature:  response.razorpay_signature,
                                pack_id:             pack.id,
                            }),
                        });

                        if (!verifyRes.ok) throw new Error('Verification failed');
                        const result = await verifyRes.json();

                        toast.success(
                            `🎉 +${result.credits_added} credits added! New balance: ${result.balance}`,
                            { id: toastId, duration: 5000 }
                        );
                        await refreshCredits();
                    } catch (err) {
                        toast.error('Payment received but credits not applied. Contact support.', { id: toastId });
                    }
                },
            });
            rzp.open();

        } catch (err) {
            toast.error(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(null);
        }
    };

    const balanceColor = creditBalance > 100 ? 'text-emerald-400' : creditBalance > 20 ? 'text-amber-400' : 'text-red-400';

    return (
        <div className="space-y-8 pb-12">

            {/* ── Current Balance Card ──────────────────────────────── */}
            <motion.section
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 text-white shadow-2xl"
            >
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                        <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-1">Your Credit Balance</p>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-6xl font-black ${balanceColor}`}>{creditBalance.toLocaleString()}</span>
                            <span className="text-white/60 text-lg">credits</span>
                        </div>
                        <p className="text-white/60 text-sm mt-2">
                            Current Plan: <span className="text-white font-semibold capitalize">{tier}</span>
                            {' · '}Credits auto-refresh monthly with your plan.
                        </p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/20">
                        <p className="text-white/70 text-xs font-medium mb-2 uppercase tracking-wider">Credit Costs</p>
                        {CREDIT_COSTS.map(c => (
                            <div key={c.action} className="flex items-center justify-between gap-6 text-sm py-1">
                                <span className="text-white/80">{c.icon} {c.action}</span>
                                <span className={c.cost === 0 ? 'text-emerald-300 font-semibold' : 'text-white font-bold'}>
                                    {c.cost === 0 ? 'Free' : `${c.cost} cr`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.section>

            {/* ── Section Header ─────────────────────────────────────── */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-black text-text-main">
                    Top Up <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">Credits</span>
                </h1>
                <p className="text-text-muted text-sm max-w-md mx-auto">
                    Credits never expire. Buy once, use anytime. All features available for everyone — just spend your credits.
                </p>
            </div>

            {/* ── Credit Pack Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {CREDIT_PACKS.map((pack) => {
                    const Icon = pack.icon;
                    return (
                        <motion.div
                            key={pack.id}
                            whileHover={{ y: -6, scale: 1.01 }}
                            className={`relative rounded-3xl p-6 border transition-all duration-300 flex flex-col ${
                                pack.popular
                                    ? 'bg-indigo-500/10 border-indigo-500 shadow-xl shadow-indigo-500/10'
                                    : 'bg-card-bg border-card-border'
                            }`}
                        >
                            {pack.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                    <Zap size={9} fill="currentColor" /> Best Value
                                </div>
                            )}

                            {/* Icon + Name */}
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${pack.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                                <Icon size={22} className="text-white" />
                            </div>
                            <h3 className="text-lg font-bold text-text-main mb-1">{pack.name}</h3>
                            <p className="text-xs text-text-muted mb-4">{pack.tagline}</p>

                            {/* Credits */}
                            <div className="flex items-center gap-2 mb-1">
                                <Coins size={16} className="text-amber-400" />
                                <span className="text-2xl font-black text-text-main">{pack.credits.toLocaleString()}</span>
                                <span className="text-text-muted text-sm">credits</span>
                            </div>
                            <p className="text-xs text-text-muted mb-6">{pack.perBill}</p>

                            {/* What you get */}
                            <div className="space-y-1 mb-6 flex-1">
                                {[
                                    `${pack.credits} bills`,
                                    `${Math.floor(pack.credits / 2)} AI chats`,
                                    `${Math.floor(pack.credits / 5)} voice bills`,
                                ].map((item) => (
                                    <div key={item} className="flex items-center gap-2 text-xs text-text-muted">
                                        <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Buy Button */}
                            <button
                                onClick={() => handleBuyPack(pack)}
                                disabled={loading === pack.id}
                                className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                                    pack.popular
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
                                        : 'bg-card-bg border border-card-border text-text-main hover:border-indigo-500/40 hover:text-indigo-500'
                                }`}
                            >
                                {loading === pack.id ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {pack.price}
                                        <ArrowRight size={14} />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── How Credits Work ───────────────────────────────────── */}
            <section className="bg-card-bg border border-card-border rounded-3xl p-6">
                <h2 className="text-lg font-bold text-text-main mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <Zap size={16} />
                    </div>
                    How Credits Work
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {[
                        { emoji: '🔄', title: 'Monthly Refresh', desc: 'Your subscription plan gives you credits every month automatically.' },
                        { emoji: '💰', title: 'Never Expire',    desc: 'Unused credits roll over forever. Buy once, use at your own pace.' },
                        { emoji: '⚡', title: 'All Features Open', desc: 'Voice, AI, Telegram Bot — all unlocked. Credits determine how much you use.' },
                    ].map(item => (
                        <div key={item.title} className="flex gap-3 p-4 bg-bg-secondary/30 rounded-2xl">
                            <span className="text-2xl">{item.emoji}</span>
                            <div>
                                <p className="font-semibold text-text-main">{item.title}</p>
                                <p className="text-text-muted text-xs mt-1">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

        </div>
    );
}
