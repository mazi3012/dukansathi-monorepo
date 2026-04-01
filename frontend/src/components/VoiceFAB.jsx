import React from 'react';
import { Bot, Sparkles, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSubscription } from '../contexts/SubscriptionContext';

const VoiceFAB = ({ onClick }) => {
    const { tier } = useSubscription();
    const isFree = tier === 'free';

    return (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClick}
                className={`flex items-center justify-center w-16 h-16 rounded-full shadow-lg border-4 border-slate-50 transition-all duration-300 relative ${
                    isFree 
                    ? 'bg-gradient-to-br from-slate-400 to-slate-600 grayscale shadow-slate-400/20' 
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20 active:shadow-indigo-500/40'
                } text-white select-none group`}
            >
                <Bot size={32} className={`transition-transform duration-300 ${isFree ? '' : 'group-hover:scale-110'}`} />
                
                {isFree && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center shadow-md">
                        <Lock size={12} className="text-white" />
                    </div>
                )}
                
                {!isFree && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center shadow-md animate-pulse">
                        <Sparkles size={12} className="text-white" />
                    </div>
                )}
            </motion.button>
        </div>
    );
};

export default VoiceFAB;
