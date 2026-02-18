import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
    Home, 
    MessageSquare, 
    Package, 
    Users, 
    TrendingUp,
    Settings,
    Store
} from 'lucide-react';

const Sidebar = () => {
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
                            flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                            ${isActive 
                                ? 'bg-indigo-50 text-indigo-700 font-medium shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                        `}
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon 
                                    size={20} 
                                    className={`
                                        transition-colors duration-200
                                        ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}
                                    `} 
                                />
                                <span>{item.label}</span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* User Profile / Footer Area */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white">
                        DS
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">My Shop</p>
                        <p className="text-xs text-slate-500 truncate">Pro Plan</p>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
