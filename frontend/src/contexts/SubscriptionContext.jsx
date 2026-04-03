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
    
    const [loading, setLoading] = useState(!subscription); // Only show loading if no cached data
    const [error, setError] = useState(null);

    const realtimeChannelRef = useRef(null);
    const refreshIntervalRef = useRef(null);
    const retryCountRef = useRef(0);       // exponential backoff counter
    const retryTimerRef = useRef(null);    // pending retry setTimeout
    const mountedRef = useRef(true);       // prevent state updates after unmount
    const nextRefreshDayRef = useRef(null); // smart check only on renewal date
    const MAX_REALTIME_RETRIES = 3;        // give up after 3 failures, rely on polling

    // Extract renewal date from cached token and calculate next refresh time
    const getNextRefreshTime = useCallback(() => {
        const cached = localStorage.getItem('ds_usage_token');
        if (!cached) return Date.now(); // Refresh immediately if no cache
        
        try {
            const parts = cached.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                // If token has renewal info, schedule refresh for that day
                if (payload.renewal_date) {
                    const renewalDate = new Date(payload.renewal_date);
                    const now = new Date();
                    
                    // If renewal date is in future, schedule check for that day at midnight
                    if (renewalDate > now) {
                        renewalDate.setHours(0, 1, 0, 0); // Check 1 minute after midnight
                        return renewalDate.getTime();
                    }
                }
            }
        } catch (_) { /* ignore */ }
        
        // Default: refresh every 24 hours
        return Date.now() + (24 * 60 * 60 * 1000);
    }, []);

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
            
            // Cache subscription data with smart expiration
            const cacheData = {
                data: data.stats,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                cachedAt: new Date().toISOString()
            };
            localStorage.setItem('ds_subscription_cache', JSON.stringify(cacheData));
            
            setSubscription(data.stats);
            setError(null);

            // Update next refresh time based on token renewal date
            if (data.token) {
                localStorage.setItem('ds_usage_token', data.token);
                nextRefreshDayRef.current = getNextRefreshTime();
            }
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err.message);

            // Fallback: use cached subscription if fetch fails
            const cached = localStorage.getItem('ds_subscription_cache');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    setSubscription(parsed.data);
                    console.log('⚠️ Using cached subscription due to fetch error');
                } catch (_) { /* ignore */ }
            }
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [getNextRefreshTime]); // eslint-disable-line react-hooks/exhaustive-deps

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

        // Smart polling: check on renewal date instead of every 5 minutes
        const setupSmartRefresh = async () => {
            nextRefreshDayRef.current = getNextRefreshTime();
            
            // Schedule next check based on renewal date
            const scheduleNextCheck = () => {
                if (!mountedRef.current) return;
                
                const now = Date.now();
                const nextRefresh = nextRefreshDayRef.current || (now + 24 * 60 * 60 * 1000);
                const delay = Math.max(0, nextRefresh - now);
                
                // Cap delay at 24 hours to ensure eventual refresh
                const cappedDelay = Math.min(delay, 24 * 60 * 60 * 1000);
                
                console.log(`📅 Next subscription check scheduled in ${Math.round(cappedDelay / 1000 / 60)} minutes`);
                
                refreshIntervalRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                        fetchSubscription();
                        scheduleNextCheck(); // Reschedule after fetch
                    }
                }, cappedDelay);
            };
            
            scheduleNextCheck();
        };

        setupSmartRefresh();

        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                retryCountRef.current = 0; // reset retries on fresh login
                fetchSubscription();
                setupRealtimeSubscription();
            } else if (event === 'SIGNED_OUT') {
                setSubscription(null);
                localStorage.removeItem('ds_usage_token');
                localStorage.removeItem('ds_subscription_cache');
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
    }, [fetchSubscription, setupRealtimeSubscription, teardownChannel, getNextRefreshTime]);

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
