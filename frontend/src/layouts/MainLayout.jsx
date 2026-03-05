import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { MessageSquare, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import NavigationDrawer from '../components/NavigationDrawer';
import { DashboardSkeleton } from '../components/Skeleton';
import { Toaster } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';

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
        return (
            <div className="min-h-screen bg-bg-main pt-6">
                <DashboardSkeleton />
            </div>
        );
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

            {/* Mobile Top Header (hidden on desktop and chat page) */}
            {location.pathname !== '/chat' && (
                <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-bg-main/80 backdrop-blur-xl border-b border-card-border/50 z-40 flex items-center px-4">
                    {/* Hamburger Menu on Left */}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="w-10 h-10 flex items-center justify-center -ml-2 text-text-muted hover:text-indigo-500 hover:bg-card-bg/80 rounded-full transition-colors"
                    >
                        <Menu size={24} />
                    </button>

                    {/* Centered Branding */}
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                        <img src={logo} alt="Logo" className="w-5 h-5 object-contain" />
                        <h1 className="font-heading font-black text-base text-text-main tracking-tight">
                            DUKAN<span className="text-indigo-600">SATHI</span>
                        </h1>
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            {/* Adjusted classes for better mobile/desktop layout. Added pt-16 on mobile non-chat to clear the header. */}
            <main className={`flex-1 transition-all duration-300 ease-in-out md:ml-64 relative z-10 ${location.pathname === '/chat' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen pt-14 md:pt-0'}`}>


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
                        onCenterClick={() => navigate('/chat')}
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
