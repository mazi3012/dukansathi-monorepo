import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    Home,
    MessageSquare,
    Package,
    Users,
    TrendingUp,
    Target,
    Settings,
    Store,
    LogOut,
    User,
    ChevronUp,
    Send,
    Link as LinkIcon,
    FileText,
    Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { CreditCard, Sparkles } from 'lucide-react';
import { useSubscription } from '../contexts/SubscriptionContext';

const Sidebar = () => {
    const navigate = useNavigate();
    const [user, setUser] = React.useState(null);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
    const { tier } = useSubscription();

    React.useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        fetchUser();
    }, []);



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
        { path: '/plans', icon: CreditCard, label: 'Plans & Usage' },
        { path: '/settings', icon: Settings, label: 'Settings' },
        { path: '/contact', icon: Headphones, label: 'Contact & Support' },
        { path: '/terms', icon: FileText, label: 'Terms & Policy' },
    ];

    return (
        <aside className="hidden md:flex flex-col w-64 glass-card h-screen fixed left-0 top-0 z-40 transition-colors duration-300">
            {/* Logo Area */}
            <div className="p-6 border-b border-card-border flex items-center gap-3 relative overflow-hidden group cursor-pointer" onClick={() => navigate('/')}>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img src={logo} alt="DukanSathi Logo" className="w-10 h-10 object-contain drop-shadow-md relative z-10" />
                <div className="relative z-10">
                    <h1 className="font-heading font-extrabold text-xl text-text-main tracking-tight transition-colors">Dukan Sathi</h1>
                    <div className="flex gap-2 items-center">
                        <span className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold px-2 py-0.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">BETA</span>
                    </div>
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
                                {item.path === '/plans' && tier === 'free' && (
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className="ml-auto w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.8)] z-10"
                                    />
                                )}
                                {!isActive && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>



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
                        {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || 'DS'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-main truncate group-hover:text-indigo-500 transition-colors">
                            {user?.user_metadata?.full_name || 'Workspace'}
                        </p>
                        <p className="text-[10px] font-medium text-text-muted lowercase truncate">
                            {String(user?.email || 'Owner').toLowerCase()}
                        </p>
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
