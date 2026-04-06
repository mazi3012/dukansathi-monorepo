import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const SubscriptionContext = createContext();

export const useSubscription = () => {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};

export const SubscriptionProvider = ({ children }) => {
    // Initialize from localStorage to prevent plan flicker
    const [subscription, setSubscription] = useState(() => {
        const cached = localStorage.getItem('ds_subscription_cache');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
                    console.log('✅ Loaded subscription from cache:', parsed.tier);
                    return parsed.data;
                }
            } catch (_) { /* fallback to null */ }
        }
        return null;
    });

    // ── Credit Balance State (Pay-As-You-Go layer) ─────────────────────
    const [creditBalance, setCreditBalance] = useState(() => {
        const cached = localStorage.getItem('ds_credit_balance_cache');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
                    return parsed.balance;
                }
            } catch (_) { }
        }
        return null; // null = not yet loaded
    });
    // ──────────────────────────────────────────────────────────────────

    const [loading, setLoading] = useState(!subscription);
    const [error, setError] = useState(null);

    const realtimeChannelRef = useRef(null);
    const creditRealtimeRef = useRef(null);
    const refreshIntervalRef = useRef(null);
    const retryCountRef = useRef(0);
    const retryTimerRef = useRef(null);
    const mountedRef = useRef(true);
    const nextRefreshDayRef = useRef(null);
    const fetchErrorCountRef = useRef(0);
    const fetchInProgressRef = useRef(false);
    const MAX_REALTIME_RETRIES = 3;
    const MIN_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes minimum between polls

    const getNextRefreshTime = useCallback(() => {
        const cached = localStorage.getItem('ds_usage_token');
        // Always return at least MIN_POLL_INTERVAL_MS in the future
        if (!cached) return Date.now() + MIN_POLL_INTERVAL_MS;
        try {
            const parts = cached.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                if (payload.renewal_date) {
                    const renewalDate = new Date(payload.renewal_date);
                    const now = new Date();
                    if (renewalDate > now) {
                        renewalDate.setHours(0, 1, 0, 0);
                        return renewalDate.getTime();
                    }
                }
            }
        } catch (_) { /* ignore */ }
        return Date.now() + (24 * 60 * 60 * 1000);
    }, []);

    // ── Fetch Credit Balance from backend ─────────────────────────────
    const fetchCreditBalance = useCallback(async () => {
        if (!mountedRef.current) return;
        if (fetchInProgressRef.current) return; // prevent concurrent fetches
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { setCreditBalance(0); return; }

            const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

            const res = await fetch(`${API_URL}/api/credits/balance`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (!mountedRef.current) return;

            setCreditBalance(data.balance);
            localStorage.setItem('ds_credit_balance_cache', JSON.stringify({
                balance: data.balance,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            }));
        } catch (err) {
            console.warn('[Credits] Failed to fetch balance:', err);
        }
    }, []);
    // ──────────────────────────────────────────────────────────────────

    const fetchSubscription = useCallback(async () => {
        if (!mountedRef.current) return;
        if (fetchInProgressRef.current) return; // prevent concurrent fetches
        fetchInProgressRef.current = true;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setSubscription(null);
                setLoading(false);
                return;
            }

            const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

            const response = await fetch(`${API_URL}/api/subscription/usage`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch subscription data');

            const data = await response.json();
            if (!mountedRef.current) return;

            const cacheData = {
                data: data.stats,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                cachedAt: new Date().toISOString()
            };
            localStorage.setItem('ds_subscription_cache', JSON.stringify(cacheData));

            setSubscription(data.stats);
            setError(null);
            fetchErrorCountRef.current = 0; // reset error backoff on success

            if (data.token) {
                localStorage.setItem('ds_usage_token', data.token);
                // No dependency on getNextRefreshTime - avoid circular dependency
            }
        } catch (err) {
            if (!mountedRef.current) return;
            fetchErrorCountRef.current += 1;
            setError(err.message);
            const cached = localStorage.getItem('ds_subscription_cache');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setSubscription(parsed.data);
                    console.log('⚠️ Using cached subscription due to fetch error');
                } catch (_) { /* ignore */ }
            }
        } finally {
            fetchInProgressRef.current = false;
            if (mountedRef.current) setLoading(false);
        }
    }, []); // ✅ NO dependencies - fetches data only, doesn't depend on other callbacks

    const teardownChannel = useCallback(() => {
        if (realtimeChannelRef.current) {
            supabase.removeChannel(realtimeChannelRef.current).catch(() => {});
            realtimeChannelRef.current = null;
        }
        if (creditRealtimeRef.current) {
            supabase.removeChannel(creditRealtimeRef.current).catch(() => {});
            creditRealtimeRef.current = null;
        }
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    const setupRealtimeSubscription = useCallback(async () => {
        if (!mountedRef.current) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        if (retryCountRef.current >= MAX_REALTIME_RETRIES) return;

        teardownChannel();
        const userId = session.user.id;

        // ── Subscription tier realtime ──────────────────────────────
        const channel = supabase
            .channel(`profile-sub-${userId}-${Date.now()}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}`,
            }, (payload) => {
                if (!mountedRef.current) return;
                const { subscription_tier } = payload.new;
                if (subscription_tier) {
                    setSubscription(prev => prev ? { ...prev, tier: subscription_tier } : prev);
                    if (subscription_tier !== 'free') {
                        toast.success(`🎉 Plan activated: ${subscription_tier.toUpperCase()}!`, {
                            duration: 5000, id: 'tier-update',
                        });
                    }
                }
                fetchSubscription();
            })
            .subscribe((status) => {
                if (!mountedRef.current) return;
                if (status === 'SUBSCRIBED') {
                    retryCountRef.current = 0;
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    retryCountRef.current += 1;
                    if (retryCountRef.current < MAX_REALTIME_RETRIES) {
                        const delay = Math.pow(2, retryCountRef.current) * 3000;
                        retryTimerRef.current = setTimeout(() => {
                            if (mountedRef.current) setupRealtimeSubscription();
                        }, delay);
                    }
                }
            });
        realtimeChannelRef.current = channel;

        // ── Credit ledger realtime — update balance on any INSERT ───
        const creditChannel = supabase
            .channel(`credit-ledger-${userId}-${Date.now()}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'credit_ledger', filter: `user_id=eq.${userId}`,
            }, (payload) => {
                if (!mountedRef.current) return;
                const { amount } = payload.new;
                setCreditBalance(prev => (prev ?? 0) + amount);
                localStorage.removeItem('ds_credit_balance_cache');
                if (amount > 0) {
                    toast.success(`✨ +${amount} credits added!`, { id: 'credit-add', duration: 3000 });
                }
            })
            .subscribe();
        creditRealtimeRef.current = creditChannel;

    }, []); // ✅ Empty array - setup once when context initializes

    useEffect(() => {
        mountedRef.current = true;
        fetchSubscription();
        fetchCreditBalance();
        setupRealtimeSubscription();

        const setupSmartRefresh = async () => {
            nextRefreshDayRef.current = getNextRefreshTime();
            const scheduleNextCheck = () => {
                if (!mountedRef.current) return;
                const now = Date.now();
                const nextRefresh = nextRefreshDayRef.current || (now + 24 * 60 * 60 * 1000);
                const rawDelay = Math.max(0, nextRefresh - now);
                // Apply exponential backoff on errors: 5min, 10min, 20min, 40min… capped at 1 hour
                const errorBackoff = fetchErrorCountRef.current > 0
                    ? Math.min(MIN_POLL_INTERVAL_MS * Math.pow(2, fetchErrorCountRef.current - 1), 60 * 60 * 1000)
                    : 0;
                // CRITICAL: never go below MIN_POLL_INTERVAL_MS to prevent infinite loops
                const delay = Math.max(MIN_POLL_INTERVAL_MS, rawDelay, errorBackoff);
                const cappedDelay = Math.min(delay, 24 * 60 * 60 * 1000);
                console.log(`📅 Next subscription check scheduled in ${Math.round(cappedDelay / 1000 / 60)} minutes`);
                refreshIntervalRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                        fetchSubscription();
                        fetchCreditBalance();
                        scheduleNextCheck();
                    }
                }, cappedDelay);
            };
            scheduleNextCheck();
        };
        setupSmartRefresh();

        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                retryCountRef.current = 0;
                fetchSubscription();
                fetchCreditBalance();
                setupRealtimeSubscription();
            } else if (event === 'SIGNED_OUT') {
                setSubscription(null);
                setCreditBalance(null);
                localStorage.removeItem('ds_usage_token');
                localStorage.removeItem('ds_subscription_cache');
                localStorage.removeItem('ds_credit_balance_cache');
                teardownChannel();
                if (refreshIntervalRef.current) clearTimeout(refreshIntervalRef.current);
            }
        });

        return () => {
            mountedRef.current = false;
            authSub.unsubscribe();
            teardownChannel();
            if (refreshIntervalRef.current) clearTimeout(refreshIntervalRef.current);
        };
    }, []); // ✅ Empty array - setup once on mount

    const tier = subscription?.tier || 'free';
    const usage = subscription?.usage || { products: 0, customers: 0, bills: 0 };
    const limits = subscription?.limits || { products: 50, customers: 50, bills: 100 };

    const isFeatureEnabled = (feature) => {
        if (!subscription) return false;
        if (tier === 'free') {
            const aiFeatures = ['ai_chat', 'voice_billing', 'predictive_analytics', 'telegram_bot'];
            if (aiFeatures.includes(feature)) {
                // Allow AI Chat and Voice Billing for free users if credits > 0
                if (feature === 'ai_chat' || feature === 'voice_billing') {
                    return creditBalance > 0;
                }
                return false;
            }
        }
        return true;
    };


    const isLimitReached = (feature) => {
        if (!subscription) return false;
        return usage[feature] >= limits[feature];
    };

    const getUsagePercent = (feature) => {
        if (!limits[feature]) return 0;
        return Math.min(100, Math.round((usage[feature] / limits[feature]) * 100));
    };

    const canAdd = (feature, navigate) => {
        if (isLimitReached(feature)) {
            toast.error(`Limit reached! Upgrade your plan to add more ${feature}.`, {
                duration: 4000, icon: '🔒'
            });
            if (navigate) navigate('/plans');
            return false;
        }
        return true;
    };

    // ── Credit Helpers ─────────────────────────────────────────────────
    const canAfford = (cost = 1) => (creditBalance ?? 0) >= cost;
    const refreshCredits = fetchCreditBalance;
    // ──────────────────────────────────────────────────────────────────

    return (
        <SubscriptionContext.Provider value={{
            subscription, loading, error,
            refreshSubscription: fetchSubscription,
            isFeatureEnabled, isLimitReached, getUsagePercent, canAdd,
            tier, usage, limits,
            // Credit system (additive — works alongside subscriptions)
            creditBalance: creditBalance ?? 0,
            refreshCredits,
            canAfford,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
};
