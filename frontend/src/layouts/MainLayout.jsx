import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
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
    const location = useLocation();
    const [isListening, setIsListening] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const handleThemeChange = () => {
            const newTheme = localStorage.getItem('theme') || 'light';
            setTheme(newTheme);
        };
        const handleStorageChange = (e) => {
            if (e.key === 'theme') handleThemeChange();
        };
        window.addEventListener('theme-changed', handleThemeChange);
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('theme-changed', handleThemeChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        checkUser();

        // Listen for auth changes (like sign out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                navigate('/landing');
            } else if (session) {
                setUser(session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUser = async () => {
        try {
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
        <div className={`flex bg-bg-main font-sans text-text-main transition-colors duration-300 ${location.pathname === '/chat' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'}`}>
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] dark:bg-indigo-500/10" />
                <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px] dark:bg-blue-500/10" />
            </div>


            {/* Desktop Sidebar (Hidden on Mobile) */}
            <div>
                <Sidebar />
            </div>

            {/* Navigation Drawer Overlay (Mobile Only) */}
            <NavigationDrawer
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                user={user}
            />

            {/* Main Content Area */}
            {/* Adjusted classes for better mobile/desktop layout */}
            <main className={`flex-1 transition-all duration-300 ease-in-out md:ml-64 relative z-10 ${location.pathname === '/chat' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'}`}>


                <div className={`${location.pathname === '/chat' ? 'h-[100dvh] flex flex-col w-full pb-0' : 'p-4 pb-24 md:pb-8 max-w-7xl mx-auto'}`}>
                    {location.pathname === '/chat' ? (
                        <Outlet context={{ user }} />
                    ) : (
                        <PageTransition
                            key={location.pathname}
                        >
                            <Outlet context={{ user }} />
                        </PageTransition>
                    )}
                </div>
            </main>

            {/* Global Toast Notifications */}
            <Toaster position="top-center" />

            {/* Sticky Bottom Nav (Hidden on Desktop or specifically on Chat page) */}
            {location.pathname !== '/chat' && (
                <div className="md:hidden">
                    <BottomNav
                        isListening={isListening}
                        onMenuClick={() => setIsMenuOpen(true)}
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
                    />
                </div>
            )}
        </div>
    );
};

const PageTransition = ({ children, className = '' }) => {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
            {children}
        </motion.div>
    );
};

export default MainLayout;
