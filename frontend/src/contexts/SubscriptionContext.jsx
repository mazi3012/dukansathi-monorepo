import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
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
            
            // Persist token if requested for tracking
            if (data.token) {
                localStorage.setItem('ds_usage_token', data.token);
            }
        } catch (err) {
            console.error('Subscription fetch error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscription();

        // Listen for auth changes
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                fetchSubscription();
            } else if (event === 'SIGNED_OUT') {
                setSubscription(null);
                localStorage.removeItem('ds_usage_token');
            }
        });

        return () => authSub.unsubscribe();
    }, [fetchSubscription]);

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
