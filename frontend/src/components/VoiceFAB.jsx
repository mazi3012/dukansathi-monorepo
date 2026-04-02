import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const VoiceFAB = ({ onClick }) => {

    return (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClick}
                className="flex items-center justify-center w-16 h-16 rounded-full shadow-lg border-4 border-slate-50 transition-all duration-300 relative bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20 active:shadow-indigo-500/40 text-white select-none group"
            >
                <Bot size={32} className="transition-transform duration-300 group-hover:scale-110" />
                
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center shadow-md animate-pulse">
                    <Sparkles size={12} className="text-white" />
                </div>
            </motion.button>
        </div>
    );
};

export default VoiceFAB;
