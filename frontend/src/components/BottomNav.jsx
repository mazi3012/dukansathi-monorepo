import React from 'react';
import { Home, Package, Receipt, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import VoiceFAB from './VoiceFAB';

const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex flex-col items-center justify-center w-full py-1 text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'text-indigo-600' : 'text-text-muted hover:text-text-main'}`
        }
    >
        <Icon size={24} strokeWidth={1.5} className="mb-1" />
        <span>{label}</span>
    </NavLink>
);

const BottomNav = ({ isListening, ...props }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-card-border shadow-2xl pb-safe z-50 rounded-t-[32px]">
            <div className="relative flex items-center justify-between h-16 px-2 max-w-md mx-auto">

                {/* Left Links */}
                <div className="flex w-2/5 justify-around">
                    <NavItem to="/" icon={Home} label="Home" />
                    <NavItem to="/inventory" icon={Package} label="Items" />
                </div>

                {/* Center Space for FAB */}
                <div className="w-1/5 relative">
                    <VoiceFAB onClick={props.onCenterClick} />
                </div>

                {/* Right Links */}
                <div className="flex w-2/5 justify-around">
                    <NavItem to="/sales" icon={Receipt} label="Sales" />
                    <NavItem to="/customers" icon={Users} label="Customers" />
                </div>

            </div>
        </div>
    );
};

export default BottomNav;
