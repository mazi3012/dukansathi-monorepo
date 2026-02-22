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
    Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const Sidebar = () => {
    const navigate = useNavigate();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/landing');
    };

    const navItems = [
        { path: '/', icon: Home, label: 'Dashboard' },
        { path: '/chat', icon: MessageSquare, label: 'AI Assistant' },
        { path: '/inventory', icon: Package, label: 'Inventory' },
        { path: '/customers', icon: Users, label: 'Customers' },
        { path: '/sales', icon: TrendingUp, label: 'Sales' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen fixed left-0 top-0 z-40">
            {/* Logo Area */}
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg">
                    <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="font-heading font-bold text-xl text-slate-800 tracking-tight">Dukan Sathi</h1>
                    <span className="text-xs text-slate-500 font-medium px-2 py-0.5 bg-slate-100 rounded-full">BETA</span>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden
                            ${isActive
                                ? 'bg-indigo-50 text-indigo-700 font-medium shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm'}
                        `}
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon
                                    size={20}
                                    className={`
                                        transition-colors duration-200 relative z-10
                                        ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}
                                    `}
                                />
                                <span className="relative z-10">{item.label}</span>
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute left-0 w-1 h-full bg-indigo-600 rounded-r-full"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}

                {/* Telegram Bot Link */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <a
                        href="https://t.me/SathiAibot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden text-slate-600 hover:bg-sky-50 hover:text-sky-600 hover:shadow-sm"
                    >
                        <Send
                            size={20}
                            className="transition-colors duration-200 text-slate-400 group-hover:text-sky-500"
                        />
                        <span className="relative z-10">Telegram Bot</span>
                        <span className="ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Open
                        </span>
                    </a>
                </div>
            </nav>

            {/* User Profile / Footer Area */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 relative">

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
                                transition={{ duration: 0.2 }}
                                className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50 p-1"
                            >
                                <button
                                    onClick={() => {
                                        navigate('/settings');
                                        setIsProfileMenuOpen(false);
                                    }}
                                    className="flex items-center gap-3 w-full p-2 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
                                >
                                    <Settings size={18} />
                                    Account Settings
                                </button>
                                <div className="h-px bg-slate-100 my-1" />
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 w-full p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors text-sm font-medium"
                                >
                                    <LogOut size={18} />
                                    Log Out
                                </button>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <div
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer select-none"
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white">
                        DS
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">My Shop</p>
                        <p className="text-xs text-slate-500 truncate">Pro Plan</p>
                    </div>
                    <ChevronUp
                        size={16}
                        className={`text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
