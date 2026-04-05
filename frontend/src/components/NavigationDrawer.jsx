import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, Package, Receipt, Users, MessageSquare, User, LogOut, Settings, Send, Link as LinkIcon, CreditCard, Target } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';

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
    const { tier } = useSubscription();

    React.useEffect(() => {
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
                                        <p className="text-[10px] font-medium text-text-muted lowercase leading-none truncate max-w-[140px]">{String(user?.email || 'App Mode').toLowerCase()}</p>
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
                            <NavItem to="/forecast" icon={Target} label="Forecast" onClick={onClose} />
                            <NavItem to="/inventory" icon={Package} label="Inventory" onClick={onClose} />
                            <NavItem to="/customers" icon={Users} label="Customers" onClick={onClose} />
                            <NavItem to="/connections" icon={LinkIcon} label="Connections" onClick={onClose} />
                            <NavItem to="/plans" icon={CreditCard} label="Plans & Usage" onClick={onClose} />
                            <NavItem to="/settings" icon={Settings} label="Settings" onClick={onClose} />
                        </div>

                        {/* Footer - Minimalist */}
                        <div className="pt-4 pb-6 border-t border-card-border/50 flex flex-col items-center justify-center relative bottom-0">
                             <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Dukan Sathi v1.2</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default NavigationDrawer;
