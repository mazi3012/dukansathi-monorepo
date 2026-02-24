import React from 'react';
import { Home, Package, Receipt, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import VoiceFAB from './VoiceFAB';

const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex flex-col items-center justify-center w-full py-1 text-xs font-medium transition-colors ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
            }`
        }
    >
        <Icon size={24} strokeWidth={1.5} className="mb-1" />
        <span>{label}</span>
    </NavLink>
);

const BottomNav = ({ isListening, onMenuClick, ...props }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe z-50">
            <div className="relative flex items-center justify-between h-16 px-2 max-w-md mx-auto">

                {/* Left Links */}
                <div className="flex w-2/5 justify-around">
                    <NavItem to="/" icon={Home} label="Home" />
                    <NavItem to="/inventory" icon={Package} label="Items" />
                </div>

                {/* Center Space for FAB */}
                <div className="w-1/5 relative">
                    <VoiceFAB
                        isListening={isListening}
                        onTouchStart={props.onTouchStart}
                        onTouchEnd={props.onTouchEnd}
                        onMouseDown={props.onMouseDown}
                        onMouseUp={props.onMouseUp}
                        onMouseLeave={props.onMouseLeave}
                    />
                </div>

                {/* Right Links */}
                <div className="flex w-2/5 justify-around">
                    <NavItem to="/sales" icon={Receipt} label="Sales" />
                    <button
                        onClick={onMenuClick}
                        className="flex flex-col items-center justify-center w-full py-1 text-xs font-medium transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <User size={24} strokeWidth={1.5} className="mb-1" />
                        <span>Menu</span>
                    </button>
                </div>

            </div>
        </div>
    );
};

export default BottomNav;
