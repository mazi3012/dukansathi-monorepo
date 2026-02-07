import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, Package, Receipt, Users, MessageSquare, User, LogOut, Settings } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const NavItem = ({ to, icon: Icon, label, onClick }) => (
    <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
            `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive
                ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`
        }
    >
        <div className={`p-2 rounded-md ${window.location.pathname === to ? 'bg-indigo-100' : 'bg-slate-100'}`}>
            <Icon size={20} strokeWidth={1.5} />
        </div>
        <span className="font-semibold text-sm">{label}</span>
    </NavLink>
);

const NavigationDrawer = ({ isOpen, onClose, user }) => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        onClose();
        navigate('/landing');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex flex-col pointer-events-none">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-white/80 backdrop-blur-xl pointer-events-auto"
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative z-10 flex flex-col h-full pointer-events-auto p-6"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                {user?.user_metadata?.avatar_url ? (
                                    <img
                                        src={user.user_metadata.avatar_url}
                                        alt="Profile"
                                        className="w-12 h-12 rounded-full border border-slate-200"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                                        {user?.email?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-lg font-bold font-heading text-slate-900 leading-tight">
                                        {user?.user_metadata?.full_name || 'Dukan Sathi'}
                                    </h2>
                                    <p className="text-xs text-slate-500 truncate max-w-[150px]">{user?.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Navigation Links */}
                        <div className="flex-1 overflow-y-auto space-y-2">
                            <NavItem to="/" icon={Home} label="Dashboard" onClick={onClose} />
                            <NavItem to="/inventory" icon={Package} label="Inventory" onClick={onClose} />
                            <NavItem to="/sales" icon={Receipt} label="Sales & Billing" onClick={onClose} />
                            <NavItem to="/customers" icon={Users} label="Customers" onClick={onClose} />
                            <NavItem to="/chat" icon={MessageSquare} label="AI Assistant" onClick={onClose} />
                            <NavItem to="/profile" icon={Settings} label="Settings" onClick={onClose} />
                        </div>

                        {/* Footer */}
                        <div className="pt-6 border-t border-slate-100">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-4 p-4 w-full text-left text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            >
                                <div className="p-2 bg-red-50 rounded-lg text-red-500">
                                    <LogOut size={24} strokeWidth={1.5} />
                                </div>
                                <span className="font-semibold text-lg">Log Out</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default NavigationDrawer;
