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
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const realtimeChannelRef = useRef(null);
    const refreshIntervalRef = useRef(null);
    const retryCountRef = useRef(0);       // exponential backoff counter
    const retryTimerRef = useRef(null);    // pending retry setTimeout
    const mountedRef = useRef(true);       // prevent state updates after unmount
    const MAX_REALTIME_RETRIES = 3;        // give up after 3 failures, rely on polling

    const fetchSubscription = useCallback(async () => {
        if (!mountedRef.current) return;
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
            setSubscription(data.stats);
            setError(null);

            if (data.token) {
                localStorage.setItem('ds_usage_token', data.token);
            }
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err.message);

            // Fallback: decode cached JWT for offline mode
            const cached = localStorage.getItem('ds_usage_token');
            if (cached) {
                try {
                    const parts = cached.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        if (payload.tier && payload.usage && payload.limits) {
                            setSubscription(prev => prev || {
                                tier: payload.tier,
                                usage: payload.usage,
                                limits: payload.limits,
                            });
                        }
                    }
                } catch (_) { /* ignore */ }
            }
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Teardown current Realtime channel cleanly
    const teardownChannel = useCallback(() => {
        if (realtimeChannelRef.current) {
            supabase.removeChannel(realtimeChannelRef.current).catch(() => {});
            realtimeChannelRef.current = null;
        }
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
    }, []);

    // Setup Supabase Realtime with exponential backoff + max retry cap
    const setupRealtimeSubscription = useCallback(async () => {
        if (!mountedRef.current) return;

        // Check user is actually logged in before attempting
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        // Stop trying after MAX_REALTIME_RETRIES — polling covers us
        if (retryCountRef.current >= MAX_REALTIME_RETRIES) return;

        teardownChannel();

        const userId = session.user.id;
        const channel = supabase
            .channel(`profile-sub-${userId}-${Date.now()}`)  // unique name avoids stale state
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    if (!mountedRef.current) return;
                    const { subscription_tier } = payload.new;

                    if (subscription_tier) {
                        setSubscription(prev => {
                            if (!prev) return prev;
                            return { ...prev, tier: subscription_tier };
                        });

                        if (subscription_tier !== 'free') {
                            toast.success(`🎉 Plan activated: ${subscription_tier.toUpperCase()}!`, {
                                duration: 5000,
                                id: 'tier-update',
                            });
                        }
                    }
                    // Full refresh for accurate usage counts
                    fetchSubscription();
                }
            )
            .subscribe((status) => {
                if (!mountedRef.current) return;

                if (status === 'SUBSCRIBED') {
                    // Reset retry counter on successful connection
                    retryCountRef.current = 0;
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    retryCountRef.current += 1;
                    if (retryCountRef.current < MAX_REALTIME_RETRIES) {
                        // Exponential backoff: 3s, 6s, 12s
                        const delay = Math.pow(2, retryCountRef.current) * 3000;
                        retryTimerRef.current = setTimeout(() => {
                            if (mountedRef.current) setupRealtimeSubscription();
                        }, delay);
                    }
                    // else: give up — the 5-min polling interval handles updates
                }
                // CLOSED: silently ignored (expected on unmount/navigation)
            });

        realtimeChannelRef.current = channel;
    }, [fetchSubscription, teardownChannel]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        mountedRef.current = true;

        fetchSubscription();
        setupRealtimeSubscription();

        // 5-minute polling as the primary fallback when Realtime gives up
        refreshIntervalRef.current = setInterval(fetchSubscription, 5 * 60 * 1000);

        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                retryCountRef.current = 0; // reset retries on fresh login
                fetchSubscription();
                setupRealtimeSubscription();
            } else if (event === 'SIGNED_OUT') {
                setSubscription(null);
                localStorage.removeItem('ds_usage_token');
                teardownChannel();
                if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
            }
        });

        return () => {
            mountedRef.current = false;
            authSub.unsubscribe();
            teardownChannel();
            if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
        };
    }, [fetchSubscription, setupRealtimeSubscription, teardownChannel]);

    const tier = subscription?.tier || 'free';
    const usage = subscription?.usage || { products: 0, customers: 0, bills: 0 };
    const limits = subscription?.limits || { products: 50, customers: 50, bills: 100 };

    const isFeatureEnabled = (feature) => {
        if (!subscription) return false;
        if (tier === 'free') {
            const aiFeatures = ['ai_chat', 'voice_billing', 'predictive_analytics', 'telegram_bot'];
            if (aiFeatures.includes(feature)) return false;
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

    return (
        <SubscriptionContext.Provider value={{
            subscription, loading, error,
            refreshSubscription: fetchSubscription,
            isFeatureEnabled, isLimitReached, getUsagePercent, canAdd,
            tier, usage, limits
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
};
