import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, Package, Receipt, Users, MessageSquare, User, LogOut, Settings, Send, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';
import { usePWA } from '../hooks/usePWA';
import { Download } from 'lucide-react';

const NavItem = ({ to, icon: Icon, label, onClick }) => (
    <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-text-muted hover:bg-card-bg hover:text-text-main border border-transparent hover:border-card-border'
            }`
        }
    >
        <div className={`p-1.5 rounded-lg transition-colors ${window.location.pathname === to ? 'bg-indigo-500/20 text-indigo-500' : 'bg-card-bg/50 text-text-muted group-hover:text-indigo-500'}`}>
            <Icon size={16} strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-sm">{label}</span>
    </NavLink>
);

const NavigationDrawer = ({ isOpen, onClose, user }) => {
    const navigate = useNavigate();
    const [isSyncing, setIsSyncing] = React.useState(true);
    const { isInstallable, installApp } = usePWA();

    React.useEffect(() => {
        const storedSyncState = localStorage.getItem('sync_enabled');
        if (storedSyncState !== null) {
            setIsSyncing(storedSyncState === 'true');
        } else {
            // Default to true
            localStorage.setItem('sync_enabled', 'true');
        }
        // Prevent background scroll when drawer is open
        if (isOpen) {
            document.body.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
        }
        // Cleanup on unmount
        return () => {
            document.body.classList.remove('overflow-hidden');
        };
    }, [isOpen]); // Re-check when drawer opens

    const handleSyncToggle = () => {
        const newState = !isSyncing;
        setIsSyncing(newState);
        localStorage.setItem('sync_enabled', String(newState));
        window.dispatchEvent(new CustomEvent('sync-toggle-changed', { detail: { isSyncing: newState } }));
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        onClose();
        navigate('/landing');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex flex-col pointer-events-none">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-bg-main/60 backdrop-blur-2xl pointer-events-auto"
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="relative z-10 flex flex-col h-[100dvh] pointer-events-auto p-4 md:p-6 overflow-hidden pb-24"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <img
                                    src={logo}
                                    alt="DukanSathi Logo"
                                    className="w-12 h-12 object-contain drop-shadow shadow-indigo-500/20"
                                />
                                <div>
                                    <h2 className="text-xl font-black font-heading text-text-main tracking-tight transition-colors">
                                        {user?.user_metadata?.full_name || 'Dukan Sathi'}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none truncate max-w-[120px]">{user?.email || 'App Mode'}</p>
                                        <button
                                            onClick={handleLogout}
                                            className="text-[9px] font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                                        >
                                            <LogOut size={10} strokeWidth={2.5} /> Logout
                                        </button>
                                    </div>
                                </div>

                            </div>
                            <button
                                onClick={onClose}
                                className="w-12 h-12 flex items-center justify-center glass-card rounded-2xl text-text-muted hover:text-text-main transition-all active:scale-95"
                            >
                                <X size={20} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Navigation Links */}
                        <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-hide py-2 px-1">
                            <NavItem to="/" icon={Home} label="Overview" onClick={onClose} />
                            <NavItem to="/chat" icon={MessageSquare} label="Dukan Sathi AI" onClick={onClose} />
                            <NavItem to="/sales" icon={Receipt} label="Sales & Billing" onClick={onClose} />
                            <NavItem to="/inventory" icon={Package} label="Inventory" onClick={onClose} />
                            <NavItem to="/customers" icon={Users} label="Customers" onClick={onClose} />
                            <NavItem to="/connections" icon={LinkIcon} label="Connections" onClick={onClose} />
                            <NavItem to="/settings" icon={Settings} label="Settings" onClick={onClose} />
                        </div>

                        {/* Footer */}
                        <div className="pt-4 pb-6 border-t border-card-border/50 flex flex-col gap-2 relative bottom-0">
                            {/* Sync Toggle */}
                            <div className="flex items-center justify-between p-3 glass-card rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl transition-colors ${isSyncing ? 'bg-indigo-500/20 text-indigo-500' : 'bg-card-bg text-text-muted'}`}>
                                        <RefreshCw size={18} strokeWidth={2} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-main">Neural Sync</span>
                                </div>
                                <button
                                    onClick={handleSyncToggle}
                                    className={`w-12 h-6 rounded-full flex items-center transition-all duration-300 p-1 ${isSyncing ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-card-bg border border-card-border'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isSyncing ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* PWA Install Button */}
                            {isInstallable && (
                                <button
                                    onClick={async () => {
                                        await installApp();
                                        window.location.reload();
                                    }}
                                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl transition-all active:scale-95 shadow-lg shadow-indigo-600/30 border border-white/10 font-bold"
                                >
                                    <Download size={18} />
                                    Install Mobile App
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default NavigationDrawer;
