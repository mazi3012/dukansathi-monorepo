import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Shield, Zap, TrendingUp, Users, Package, FileText, PhoneCall, ArrowDown } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const Plans = () => {
    const { tier, usage, limits, refreshSubscription } = useSubscription();
    const [loading, setLoading] = useState(null);

    const plans = [
        {
            id: 'free',
            name: 'Free',
            price: '₹0',
            description: 'For micro shops & new startups',
            features: [
                '50 Products Limit',
                '50 Customers Limit',
                '100 Bills per Month',
                '20 AI Credits / Month',
                'Basic Reporting',
                'Offline Sync'
            ],
            limits: { products: 50, customers: 50, bills: 100, ai_credits: 20 },
            color: 'gray',
            buttonText: 'Free Plan'
        },
        {
            id: 'starter',
            name: 'Starter',
            price: '₹149',
            period: '/month',
            description: 'Essential tools for growing shops',
            features: [
                '500 Products Limit',
                '500 Customers Limit',
                '1,000 Bills / Month',
                'GST Billing Support',
                'AI Chat Assistant',
                '14-Day Free Trial'
            ],
            limits: { products: 500, customers: 500, bills: 1000 },
            color: 'blue',
            buttonText: 'Upgrade to Starter',
            rzpPlanId: 'plan_SYJ1J3QjtX1mAK'
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '₹399',
            period: '/month',
            description: 'The smart choice for retail',
            isPopular: true,
            features: [
                '2,000 Products Limit',
                '2,000 Customers Limit',
                '5,000 Bills / Month',
                'Full AI Memory (Sathi)',
                'Telegram Bot Access',
                '14-Day Free Trial'
            ],
            limits: { products: 2000, customers: 2000, bills: 5000 },
            color: 'indigo',
            buttonText: 'Go Pro',
            rzpPlanId: 'plan_SYJ1ZJWBFTgZWx'
        },
        {
            id: 'ultra',
            name: 'Ultra',
            price: '₹799',
            period: '/month',
            description: 'Maximum power for busy shops',
            features: [
                '10,000 Products Limit',
                '10,000 Customers Limit',
                '20,000 Bills / Month',
                'Voice-to-Bill (Hands-free)',
                'AI Predictive Analytics',
                'Priority AI Response'
            ],
            limits: { products: 10000, customers: 10000, bills: 20000 },
            color: 'purple',
            buttonText: 'Get Ultra',
            rzpPlanId: 'plan_SYJ1a3OcE6bwDB'
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: 'Custom',
            description: 'Tailored for wholesalers & chains',
            features: [
                'Custom Product Limits',
                'Custom Invoice Volume',
                'Dedicated Account Manager',
                'Multi-Staff Access',
                'Custom Feature Development',
                'Priority Support'
            ],
            limits: { products: 'Unlimited*', customers: 'Unlimited*', bills: 'Unlimited*' },
            color: 'pink',
            buttonText: 'Contact Us'
        }
    ];

    const handleCancelSubscription = async () => {
        if (tier === 'free') return;
        
        const confirmed = window.confirm(
            `Are you sure you want to downgrade from ${tier.toUpperCase()} to FREE?\n\nYou will lose access to paid features immediately.`
        );
        if (!confirmed) return;
        
        setLoading('free');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

            const response = await fetch(`${API_URL}/api/subscription/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || 'Failed to cancel subscription');
            }

            toast.success('Downgraded to Free plan successfully.', { icon: '✅' });
            localStorage.removeItem('ds_subscription_cache');
            localStorage.removeItem('ds_usage_token');
            await refreshSubscription();
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Failed to downgrade. Please try again.');
        } finally {
            setLoading(null);
        }
    };

    const handleSubscribe = async (plan) => {
        if (plan.id === tier) return;
        if (plan.id === 'free') {
            handleCancelSubscription();
            return;
        }
        if (plan.id === 'enterprise') {
            window.open('https://wa.me/your_number', '_blank');
            return;
        }

        setLoading(plan.id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

            const response = await fetch(`${API_URL}/api/subscription/create?plan_id=${plan.rzpPlanId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) throw new Error('Failed to create subscription');
            const subscription = await response.json();

            const rzpKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
            if (!rzpKey) {
                toast.error('Payment system not configured. Please contact support.');
                return;
            }

            // Ensure Razorpay script is loaded (deferred in index.html,
            // may not be ready if user navigated to Plans quickly)
            await new Promise((resolve, reject) => {
                if (typeof window.Razorpay === 'function') { resolve(); return; }
                const existing = document.querySelector('script[src*="razorpay"]');
                if (existing) {
                    existing.addEventListener('load', resolve);
                    existing.addEventListener('error', () => reject(new Error('Razorpay load failed')));
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
                document.head.appendChild(script);
            });

            // Razorpay Checkout
            const options = {
                key: rzpKey,
                subscription_id: subscription.id,
                name: 'Dukan Sathi AI',
                description: `${plan.name} Subscription`,
                image: '/logo.svg',
                handler: async function (response) {
                    const toastId = toast.loading(`Activating ${plan.name} plan...`, { duration: 30000 });
                    
                    const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
                    const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
                    
                    // ── PRIMARY: Direct server-side verification ──────────
                    try {
                        const { data: { session: freshSession } } = await supabase.auth.getSession();
                        if (!freshSession) throw new Error('Session expired');
                        
                        const verifyRes = await fetch(`${API_URL}/api/subscription/verify`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${freshSession.access_token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_subscription_id: response.razorpay_subscription_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });
                        
                        if (verifyRes.ok) {
                            const result = await verifyRes.json();
                            console.log('[Verify] ✅ Plan activated:', result);
                            toast.success(`🎉 ${plan.name} plan activated! Welcome aboard.`, { id: toastId });
                            // Clear stale cache so context fetches fresh data
                            localStorage.removeItem('ds_subscription_cache');
                            localStorage.removeItem('ds_usage_token');
                            await refreshSubscription();
                            return;
                        }
                        
                        // Verify endpoint returned an error — log and fall through to polling
                        const errData = await verifyRes.json().catch(() => ({}));
                        console.warn('[Verify] Server returned error:', verifyRes.status, errData);
                    } catch (verifyErr) {
                        console.warn('[Verify] Direct verification failed, falling back to polling:', verifyErr);
                    }
                    
                    // ── FALLBACK: Poll for webhook-based activation ──────
                    let attempts = 0;
                    const maxAttempts = 15; // 30 seconds (2s × 15)
                    const poll = async () => {
                        attempts++;
                        console.log(`[Poll ${attempts}/${maxAttempts}] Checking subscription status...`);
                        try {
                            const { data: { session: pollSession } } = await supabase.auth.getSession();
                            if (pollSession) {
                                await refreshSubscription();
                                
                                const res = await fetch(`${API_URL}/api/subscription/usage`, {
                                    headers: { 'Authorization': `Bearer ${pollSession.access_token}` }
                                });
                                
                                if (res.ok) {
                                    const d = await res.json();
                                    console.log(`[Poll ${attempts}] Current tier: ${d.stats?.tier}, Target: ${plan.id}`);
                                    if (d.stats?.tier === plan.id) {
                                        toast.success(`🎉 ${plan.name} plan activated! Welcome aboard.`, { id: toastId });
                                        localStorage.removeItem('ds_subscription_cache');
                                        localStorage.removeItem('ds_usage_token');
                                        await refreshSubscription();
                                        return;
                                    }
                                }
                            }
                        } catch (err) {
                            console.warn(`[Poll ${attempts}] Error:`, err);
                        }

                        if (attempts < maxAttempts) {
                            setTimeout(poll, 2000);
                        } else {
                            toast.success(`Payment successful! Your plan is being activated. If not updated in 5 minutes, contact support.`, { id: toastId });
                            localStorage.removeItem('ds_subscription_cache');
                            await refreshSubscription();
                        }
                    };
                    
                    setTimeout(poll, 1500);
                },
                prefill: {
                    name: session.user.user_metadata?.full_name || '',
                    email: session.user.email
                },
                theme: { color: '#4f46e5' }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (err) {
            console.error(err);
            toast.error('Subscription failed. Please try again.');
        } finally {
            setLoading(null);
        }
    };

    const UsageProgress = ({ label, icon: Icon, current, max, color }) => {
        const percentage = Math.min(100, (current / max) * 100);
        const isNearLimit = percentage > 85;

        return (
            <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-text-main">
                        <Icon size={16} className={`text-${color}-500`} />
                        <span>{label}</span>
                    </div>
                    <span className={`text-xs ${isNearLimit ? 'text-red-500 font-bold' : 'text-text-muted'}`}>
                        {current} / {max}
                    </span>
                </div>
                <div className="h-2 bg-card-bg/50 rounded-full overflow-hidden border border-card-border/50">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className={`h-full rounded-full ${isNearLimit ? 'bg-red-500' : `bg-${color}-500`}`}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Usage Overview */}
            <section className="bg-card-bg border border-card-border rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Zap size={120} />
                </div>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                        <TrendingUp size={18} />
                    </div>
                    Current Usage ({tier.toUpperCase()})
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <UsageProgress label="Products" icon={Package} current={usage.products} max={limits.products === 'Unlimited*' ? 1 : limits.products} color="blue" />
                    <UsageProgress label="Customers" icon={Users} current={usage.customers} max={limits.customers === 'Unlimited*' ? 1 : limits.customers} color="indigo" />
                    <UsageProgress label="Bills (This Month)" icon={FileText} current={usage.bills} max={limits.bills === 'Unlimited*' ? 1 : limits.bills} color="purple" />
                    <UsageProgress label="AI Credits" icon={Zap} current={usage.ai_credits} max={limits.ai_credits === 'Unlimited*' ? 1 : limits.ai_credits} color="amber" />
                </div>
                
                {tier === 'free' && (
                    <div className="mt-6 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex items-center gap-3">
                        <div className="p-2 bg-indigo-500 rounded-full text-white animate-pulse">
                            <Star size={16} fill="currentColor" />
                        </div>
                        <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                            You are using the Free plan. Upgrade for AI Assistant and higher limits!
                        </p>
                    </div>
                )}
            </section>

            {/* Pricing Tiers */}
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-black tracking-tight text-text-main md:text-5xl">
                    Upgrade to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">Smart Shop</span>
                </h1>
                <p className="text-text-muted max-w-lg mx-auto">
                    Power your business with Voice-to-Bill and AI Analytics. All paid plans include a 14-day free trial.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.filter(p => p.id !== 'enterprise').map((plan) => (
                    <motion.div
                        key={plan.id}
                        whileHover={{ y: -5 }}
                        className={`relative p-6 rounded-3xl border transition-all duration-300 ${
                            plan.isPopular 
                            ? 'bg-indigo-500/5 border-indigo-500 shadow-xl scale-105 z-10' 
                            : 'bg-card-bg border-card-border'
                        } ${tier === plan.id ? 'opacity-90 ring-2 ring-emerald-500 ring-offset-4 ring-offset-bg-main' : ''}`}
                    >
                        {plan.isPopular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <Zap size={10} fill="currentColor" /> Most Popular
                            </div>
                        )}
                        {tier === plan.id && (
                            <div className="absolute top-4 right-4 text-emerald-500">
                                <Shield className="fill-emerald-500/10" size={20} />
                            </div>
                        )}

                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-text-main mb-1">{plan.name}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-text-main">{plan.price}</span>
                                {plan.period && <span className="text-sm text-text-muted">{plan.period}</span>}
                            </div>
                            <p className="text-xs text-text-muted mt-2">{plan.description}</p>
                        </div>

                        <div className="space-y-3 mb-8">
                            {plan.features.map((feature, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-text-main">
                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => handleSubscribe(plan)}
                            disabled={tier === plan.id || loading === plan.id}
                            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all ${
                                tier === plan.id 
                                ? 'bg-emerald-500/10 text-emerald-500 cursor-default border border-emerald-500/20'
                                : plan.id === 'free' && tier !== 'free'
                                ? 'bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20'
                                : plan.isPopular
                                ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'
                                : 'bg-card-bg border border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5'
                            } disabled:opacity-50`}
                        >
                            {loading === plan.id ? 'Processing...' : (
                                tier === plan.id ? '✓ Current Plan' : (
                                    plan.id === 'free' && tier !== 'free' 
                                    ? '↓ Downgrade to Free' 
                                    : plan.buttonText
                                )
                            )}
                        </button>
                    </motion.div>
                ))}
            </div>

            {/* Enterprise Card */}
            <div className="bg-gradient-to-r from-gray-900 to-indigo-900 rounded-3xl p-8 border border-white/10 relative overflow-hidden">
                <div className="absolute -right-12 -bottom-12 p-4 text-white/5">
                    <PhoneCall size={260} />
                </div>
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    <div className="md:col-span-2">
                        <h2 className="text-2xl font-black text-white mb-2">Need more? Explore Enterprise.</h2>
                        <p className="text-white/60 mb-6 max-w-xl">
                            Scalable solutions for medium-to-large wholesalers, regional chains, and high-volume traders. 
                            Get unlimited billing, custom AI training, and specialized reporting.
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm font-medium text-white/80">
                            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-400" /> Multi-Shop Sync</span>
                            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-400" /> Priority Support</span>
                            <span className="flex items-center gap-1"><Check size={14} className="text-emerald-400" /> White Labeling</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleSubscribe(plans.find(p => p.id === 'enterprise'))}
                        className="bg-white text-indigo-900 h-14 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors shadow-2xl"
                    >
                        Talk to an Expert <Zap size={18} fill="currentColor" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Plans;
