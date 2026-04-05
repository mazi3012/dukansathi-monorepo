import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Coins, Bell } from 'lucide-react';
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
    const { tier, creditBalance } = useSubscription();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
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

    const fetchNotifications = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            const apiUrl = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
            const res = await fetch(`${apiUrl}/api/notifications?limit=20`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            if (!res.ok) return;

            const data = await res.json();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unread_count || 0);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    };

    const markNotificationRead = async (notificationId) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const rawApiUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://127.0.0.1:8000';
            const apiUrl = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
            await fetch(`${apiUrl}/api/notifications/mark-read`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ notification_id: notificationId }),
            });

            setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    useEffect(() => {
        if (!user) return;
        fetchNotifications();
        const timer = setInterval(fetchNotifications, 60000);
        return () => clearInterval(timer);
    }, [user]);

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
                    <div className="flex items-center gap-3 relative">
                        <button
                            onClick={() => setIsNotifOpen((v) => !v)}
                            className="relative w-10 h-10 rounded-full border border-card-border bg-card-bg/50 text-text-muted hover:text-indigo-500 transition-colors flex items-center justify-center"
                            aria-label="Open notifications"
                        >
                            <Bell size={18} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {isNotifOpen && (
                            <div className="absolute right-0 top-12 w-[320px] max-h-[420px] overflow-y-auto glass-card border border-card-border rounded-2xl shadow-2xl p-2 z-50">
                                <div className="px-2 py-2 border-b border-card-border/50 flex items-center justify-between">
                                    <p className="text-sm font-bold text-text-main">Notifications</p>
                                    <p className="text-xs text-text-muted">{unreadCount} unread</p>
                                </div>
                                {(notifications || []).length === 0 ? (
                                    <p className="text-sm text-text-muted p-3">No notifications yet.</p>
                                ) : (
                                    <div className="space-y-1 pt-1">
                                        {notifications.map((n) => (
                                            <button
                                                key={n.id}
                                                onClick={() => {
                                                    if (!n.is_read) markNotificationRead(n.id);
                                                }}
                                                className={`w-full text-left p-3 rounded-xl border transition-colors ${n.is_read ? 'border-card-border/30 bg-card-bg/30' : 'border-indigo-500/30 bg-indigo-500/10'}`}
                                            >
                                                <p className="text-xs font-black uppercase tracking-wider text-text-muted">{n.type}</p>
                                                <p className="text-sm font-semibold text-text-main mt-1">{n.title}</p>
                                                <p className="text-xs text-text-muted mt-1">{n.message}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Credit Coin */}
                        <button
                            onClick={() => navigate('/credits')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                                creditBalance > 50
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:border-amber-500/40'
                                    : creditBalance > 10
                                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-500 hover:border-orange-500/40'
                                    : 'bg-red-500/10 border-red-500/20 text-red-500 hover:border-red-500/40 animate-pulse'
                            }`}
                        >
                            <Coins size={14} />
                            <span className="text-xs font-black">{creditBalance.toLocaleString()}</span>
                        </button>
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
