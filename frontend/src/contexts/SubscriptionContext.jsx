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

    const fetchSubscription = useCallback(async () => {
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
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch subscription data');
            }

            const data = await response.json();
            // data contains { token, stats: { tier, usage, limits } }
            setSubscription(data.stats);
            setError(null);

            // Persist token for offline use
            if (data.token) {
                localStorage.setItem('ds_usage_token', data.token);
            }
        } catch (err) {
            console.error('Subscription fetch error:', err);
            setError(err.message);

            // Fallback: try to load cached token from localStorage
            const cached = localStorage.getItem('ds_usage_token');
            if (cached && !subscription) {
                try {
                    // Decode the JWT payload (no verification needed client-side)
                    const parts = cached.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        if (payload.tier && payload.usage && payload.limits) {
                            setSubscription({
                                tier: payload.tier,
                                usage: payload.usage,
                                limits: payload.limits,
                            });
                        }
                    }
                } catch (_) { /* ignore parse errors */ }
            }
        } finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Subscribe to Realtime changes on the profiles table
    const setupRealtimeSubscription = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        // Cleanup old channel if exists
        if (realtimeChannelRef.current) {
            supabase.removeChannel(realtimeChannelRef.current);
        }

        const channel = supabase
            .channel(`profile-subscription-${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${session.user.id}`,
                },
                (payload) => {
                    console.log('[Realtime] Profile updated:', payload.new);
                    const { subscription_tier, subscription_status } = payload.new;
                    
                    // Update the tier in local state immediately (no round-trip needed)
                    if (subscription_tier) {
                        setSubscription(prev => {
                            if (!prev) return prev;
                            const updated = { ...prev, tier: subscription_tier };
                            console.log('[Subscription] Tier updated to:', subscription_tier);
                            return updated;
                        });

                        // Show a toast if tier actually changed
                        if (subscription_tier !== 'free') {
                            toast.success(`🎉 Plan activated: ${subscription_tier.toUpperCase()}!`, {
                                duration: 5000,
                                id: 'tier-update',
                            });
                        }
                    }
                    
                    // Then do a full refresh to get accurate usage counts
                    fetchSubscription();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Subscribed to profile changes');
                }
            });

        realtimeChannelRef.current = channel;
    }, [fetchSubscription]);

    useEffect(() => {
        fetchSubscription();
        setupRealtimeSubscription();

        // Refresh every 5 minutes as a background safety net
        refreshIntervalRef.current = setInterval(fetchSubscription, 5 * 60 * 1000);

        // Listen for auth changes
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                fetchSubscription();
                setupRealtimeSubscription();
            } else if (event === 'SIGNED_OUT') {
                setSubscription(null);
                localStorage.removeItem('ds_usage_token');
                
                // Cleanup realtime channel
                if (realtimeChannelRef.current) {
                    supabase.removeChannel(realtimeChannelRef.current);
                    realtimeChannelRef.current = null;
                }
                
                // Clear refresh interval
                if (refreshIntervalRef.current) {
                    clearInterval(refreshIntervalRef.current);
                }
            }
        });

        return () => {
            authSub.unsubscribe();
            if (realtimeChannelRef.current) {
                supabase.removeChannel(realtimeChannelRef.current);
            }
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [fetchSubscription, setupRealtimeSubscription]);

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

    // Returns true if the user has hit the limit for a given feature
    const isLimitReached = (feature) => {
        if (!subscription) return false;
        return usage[feature] >= limits[feature];
    };

    // Returns usage as a percentage (0–100)
    const getUsagePercent = (feature) => {
        if (!limits[feature]) return 0;
        return Math.min(100, Math.round((usage[feature] / limits[feature]) * 100));
    };

    // Call this before creating a new item. Shows toast & navigates if limit reached.
    const canAdd = (feature, navigate) => {
        if (isLimitReached(feature)) {
            toast.error(
                `Limit reached! Upgrade your plan to add more ${feature}.`,
                { duration: 4000, icon: '🔒' }
            );
            if (navigate) navigate('/plans');
            return false;
        }
        return true;
    };

    return (
        <SubscriptionContext.Provider value={{
            subscription,
            loading,
            error,
            refreshSubscription: fetchSubscription,
            isFeatureEnabled,
            isLimitReached,
            getUsagePercent,
            canAdd,
            tier,
            usage,
            limits
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
};
