import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    Home,
    MessageSquare,
    Package,
    Users,
    TrendingUp,
    Settings,
    Store,
    LogOut,
    User,
    ChevronUp,
    Send,
    Link as LinkIcon,
    RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
    const [isSyncing, setIsSyncing] = React.useState(true);

    React.useEffect(() => {
        const storedSyncState = localStorage.getItem('auto_sync_enabled');
        if (storedSyncState !== null) {
            setIsSyncing(storedSyncState === 'true');
        } else {
            // Default to true
            localStorage.setItem('auto_sync_enabled', 'true');
        }
    }, []);

    const handleSyncToggle = () => {
        const newState = !isSyncing;
        setIsSyncing(newState);
        localStorage.setItem('auto_sync_enabled', String(newState));
        // You can dispatch a custom event here if other components need to react instantly to the toggle change
        window.dispatchEvent(new CustomEvent('sync-toggle-changed', { detail: { isSyncing: newState } }));
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/landing');
    };

    const navItems = [
        { path: '/', icon: Home, label: 'Overview' },
        { path: '/chat', icon: MessageSquare, label: 'Dukan Sathi AI' },
        { path: '/sales', icon: TrendingUp, label: 'Sales Ledger' },
        { path: '/inventory', icon: Package, label: 'Inventory' },
        { path: '/customers', icon: Users, label: 'Customers' },
        { path: '/connections', icon: LinkIcon, label: 'Connections' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 glass-card h-screen fixed left-0 top-0 z-40 transition-colors duration-300">
            {/* Logo Area */}
            <div className="p-6 border-b border-card-border flex items-center gap-3 relative overflow-hidden group cursor-pointer" onClick={() => navigate('/')}>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img src="/src/assets/logo.svg" alt="DukanSathi Logo" className="w-10 h-10 object-contain drop-shadow-md relative z-10" />
                <div className="relative z-10">
                    <h1 className="font-heading font-extrabold text-xl text-text-main tracking-tight transition-colors">Dukan Sathi</h1>
                    <span className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold px-2 py-0.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">BETA</span>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 scrollbar-hide">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden
                            ${isActive
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                : 'text-text-muted hover:bg-card-bg hover:text-indigo-500 border border-transparent hover:border-card-border'}
                        `}
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon
                                    size={20}
                                    className={`
                                        transition-colors duration-300 relative z-10
                                        ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'}
                                    `}
                                />
                                <span className="relative z-10 font-medium text-sm">{item.label}</span>
                                {!isActive && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Sync Toggle */}
            <div className="px-6 py-4 border-t border-card-border bg-card-bg/50 backdrop-blur-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <RefreshCw size={18} className={`transition-colors duration-300 ${isSyncing ? 'text-indigo-500' : 'text-text-muted'}`} />
                        <span className="text-sm font-semibold text-text-main transition-colors">Auto Sync</span>
                    </div>
                    <button
                        onClick={handleSyncToggle}
                        className={`w-11 h-6 rounded-full flex items-center transition-colors duration-300 p-1 ${isSyncing ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isSyncing ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            {/* User Profile / Footer Area */}
            <div className="p-4 border-t border-card-border bg-card-bg/50 backdrop-blur-md relative">
                <AnimatePresence>
                    {isProfileMenuOpen && (
                        <>
                            {/* Backdrop to close menu when clicking outside */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsProfileMenuOpen(false)}
                            />

                            {/* Menu */}
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: -0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.2, type: "spring", stiffness: 200 }}
                                className="absolute bottom-[calc(100%+8px)] left-4 right-4 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200/50 overflow-hidden z-50 p-1.5"
                            >
                                <button
                                    onClick={() => {
                                        navigate('/settings');
                                        setIsProfileMenuOpen(false);
                                    }}
                                    className="flex items-center gap-3 w-full p-3 hover:bg-slate-50 rounded-xl text-slate-700 hover:text-indigo-600 transition-colors text-sm font-bold"
                                >
                                    <Settings size={18} />
                                    Account Settings
                                </button>
                                <div className="h-px bg-slate-100 my-1 mx-2" />
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 w-full p-3 hover:bg-red-50 rounded-xl text-red-600 transition-colors text-sm font-bold"
                                >
                                    <LogOut size={18} />
                                    Sign Out
                                </button>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <div
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card-bg border border-transparent hover:border-card-border transition-all cursor-pointer select-none group"
                >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-heading font-bold text-xs shadow-inner">
                        DS
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-main truncate group-hover:text-indigo-500 transition-colors">Workspace</p>
                        <p className="text-[11px] font-medium text-text-muted truncate">Owner</p>
                    </div>
                    <ChevronUp
                        size={16}
                        className={`text-text-muted transition-transform duration-300 ${isProfileMenuOpen ? 'rotate-180 text-indigo-500' : 'group-hover:text-indigo-500'}`}
                    />
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
