import { supabase } from './supabase';

const SESSION_CACHE_KEY = 'dukansathi_session_cache';
const PROFILE_CACHE_KEY = 'dukansathi_profile_cache';

export const authService = {
    /**
     * Gets the current user, falling back to cached session if offline/Supabase fails.
     */
    async getCurrentUser() {
        try {
            // 1. Try to get fresh user from Supabase
            const { data: { user }, error } = await supabase.auth.getUser();

            if (user && !error) {
                // Cache the user ID and email
                localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
                    id: user.id,
                    email: user.email,
                    last_seen: new Date().toISOString()
                }));
                return user;
            }
        } catch (err) {
            console.warn("Supabase auth check failed (likely offline):", err);
        }

        // 2. Fallback to cached session
        const cached = localStorage.getItem(SESSION_CACHE_KEY);
        if (cached) {
            console.log("Using cached session for offline mode");
            return JSON.parse(cached);
        }

        return null;
    },

    /**
     * Gets the user profile, caching it for offline use.
     */
    async getCurrentProfile(userId) {
        if (!userId) {
            const user = await this.getCurrentUser();
            if (!user) return null;
            userId = user.id;
        }

        try {
            if (navigator.onLine) {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (profile && !error) {
                    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
                    return profile;
                }
            }
        } catch (err) {
            console.warn("Profile fetch failed:", err);
        }

        // Fallback to cached profile
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }

        return null;
    },

    /**
     * Updates the local session cache manually (e.g. after login)
     */
    cacheSession(user) {
        if (user) {
            localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
                id: user.id,
                email: user.email,
                last_seen: new Date().toISOString()
            }));
        }
    }
};
