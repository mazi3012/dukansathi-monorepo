import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import NavigationDrawer from '../components/NavigationDrawer';
import Loader from '../components/Loader';
import { Toaster } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const MainLayout = () => {
    const navigate = useNavigate();
    const [isListening, setIsListening] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUser();

        // Listen for auth changes (like sign out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const isGuest = localStorage.getItem('guest_mode') === 'true';

            if (!session && !isGuest) {
                navigate('/landing');
            } else if (session) {
                setUser(session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUser = async () => {
        try {
            const isGuest = localStorage.getItem('guest_mode') === 'true';

            if (isGuest) {
                // Set dummy guest user
                setUser({
                    id: 'guest_user_123',
                    email: 'guest@demo.com',
                    user_metadata: {
                        full_name: 'Guest User'
                    }
                });
                setLoading(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/landing');
            } else {
                setUser(user);
                // Check onboarding status
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('onboarding_completed')
                    .eq('id', user.id)
                    .single();

                if (!profile || !profile.onboarding_completed) {
                    navigate('/onboarding');
                }
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            navigate('/landing');
        } finally {
            setLoading(false);
        }
    };

    const toggleListening = () => {
        setIsListening(false); // We can rely on the Chat page to handle actual listening
        navigate('/chat', { state: { autoStartRecord: true } });
    };

    if (loading) {
        return <Loader />;
    }

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">

            {/* Desktop Sidebar (Hidden on Mobile) */}
            <Sidebar />

            {/* Navigation Drawer Overlay (Mobile Only) */}
            <NavigationDrawer
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                user={user}
            />

            {/* Main Content Area */}
            {/* Adjusted classes for better mobile/desktop layout */}
            <main className="flex-1 transition-all duration-300 ease-in-out md:ml-64 relative min-h-screen">
                <div className="p-4 pb-24 md:pb-8 max-w-7xl mx-auto">
                    <Outlet context={{ user }} />
                </div>
            </main>

            {/* Global Toast Notifications */}
            <Toaster position="top-center" />

            {/* Sticky Bottom Nav (Hidden on Desktop) */}
            <div className="md:hidden">
                <BottomNav
                    isListening={isListening}
                    // onTouchStart / onMouseDown logic: Navigate to chat and trigger 'mic-press' event
                    onTouchStart={(e) => {
                        e.preventDefault();
                        window.__isMicHeld = true;
                        if (window.location.pathname !== '/chat') {
                            navigate('/chat', { state: { autoStartRecord: true } });
                        } else {
                            window.dispatchEvent(new CustomEvent('nav-mic-press'));
                        }
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        window.__isMicHeld = true;
                        if (window.location.pathname !== '/chat') {
                            navigate('/chat', { state: { autoStartRecord: true } });
                        } else {
                            window.dispatchEvent(new CustomEvent('nav-mic-press'));
                        }
                    }}
                    // onTouchEnd / onMouseUp logic: Trigger 'mic-release' event
                    onTouchEnd={(e) => {
                        e.preventDefault();
                        window.__isMicHeld = false;
                        window.dispatchEvent(new CustomEvent('nav-mic-release'));
                    }}
                    onMouseUp={(e) => {
                        e.preventDefault();
                        window.__isMicHeld = false;
                        window.dispatchEvent(new CustomEvent('nav-mic-release'));
                    }}
                    onMouseLeave={(e) => {
                        window.__isMicHeld = false;
                        window.dispatchEvent(new CustomEvent('nav-mic-release'));
                    }}
                    onMenuClick={() => setIsMenuOpen(true)}
                />
            </div>

        </div>
    );
};

export default MainLayout;
