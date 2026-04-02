import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { MessageSquare, Menu, CreditCard, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import NavigationDrawer from '../components/NavigationDrawer';
import Chat from '../pages/Chat';
import { DashboardSkeleton } from '../components/Skeleton';
import { Toaster } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';
import { useSubscription } from '../contexts/SubscriptionContext';

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { tier } = useSubscription();
    const [isListening, setIsListening] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const handleThemeChange = () => {
            const newTheme = localStorage.getItem('theme') || 'dark';
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

            {/* Global Top Header */}
            {location.pathname !== '/chat' && (
                <header className="fixed top-0 left-0 md:left-64 right-0 h-16 bg-bg-main/80 backdrop-blur-xl border-b border-card-border/50 z-40 flex items-center justify-between px-4 sm:px-6 transition-all duration-300">
                    {/* Hamburger Menu (Mobile Only) */}
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="md:hidden w-10 h-10 flex items-center justify-center -ml-2 text-text-muted hover:text-indigo-500 hover:bg-card-bg/80 rounded-full transition-colors"
                    >
                        <Menu size={22} />
                    </button>

                    {/* Branding / Page Title Context */}
                    <div className="flex items-center gap-3">
                        <div className="flex md:hidden items-center gap-2">
                            <img src={logo} alt="Logo" className="w-6 h-6 object-contain" />
                            <h1 className="font-heading font-black text-sm text-text-main tracking-tight">
                                DUKAN<span className="text-indigo-600">SATHI</span>
                            </h1>
                        </div>
                        {/* Desktop Page Context (Optional) */}
                        <div className="hidden md:block">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/50 leading-none">
                                {location.pathname === '/' ? 'Dashboard Overview' : location.pathname.substring(1).split('/')[0].toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Right Side Actions: Plan & Upgrade */}
                    <div className="flex items-center gap-3">
                        {/* Plan Badge */}
                        <div 
                            onClick={() => navigate('/plans')}
                            className={`plan-badge cursor-pointer whitespace-nowrap plan-badge-${tier}`}
                        >
                            <CreditCard size={12} />
                            <span>{tier}</span>
                        </div>

                        {/* Upgrade Button (Only for Free Tier) */}
                        {tier === 'free' && (
                            <button
                                onClick={() => navigate('/plans')}
                                className="upgrade-btn premium-pulse hidden sm:flex"
                            >
                                <Sparkles size={14} />
                                <span>Upgrade</span>
                            </button>
                        )}
                        
                        {/* Mobile Minimal Upgrade Link */}
                        {tier === 'free' && (
                            <button
                                onClick={() => navigate('/plans')}
                                className="sm:hidden w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-lg"
                            >
                                <Sparkles size={14} />
                            </button>
                        )}
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className={`flex-1 transition-all duration-300 ease-in-out md:ml-64 relative ${location.pathname === '/chat' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen pt-16'}`}>
                {/* Persistent Chat Layer */}
                <div 
                    className={`h-[100dvh] flex flex-col w-full pb-0 ${location.pathname === '/chat' ? 'block' : 'hidden'}`}
                    aria-hidden={location.pathname !== '/chat'}
                >
                    <Chat />
                </div>

                {/* Other Pages */}
                <div className={`${location.pathname === '/chat' ? 'hidden' : 'p-4 pb-24 md:pb-8 max-w-7xl mx-auto'}`}>
                    <PageTransition key={location.pathname}>
                        <Outlet context={{ user }} />
                    </PageTransition>
                </div>
            </main>

            {/* Global Toast Notifications */}
            <Toaster position="top-center" />

            {/* Sticky Bottom Nav (Hidden on Desktop or specifically on Chat page) */}
            {location.pathname !== '/chat' && (
                <div className="md:hidden">
                    <BottomNav
                        onCenterClick={() => {
                            if (tier === 'free') {
                                navigate('/plans');
                            } else {
                                navigate('/chat');
                            }
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
