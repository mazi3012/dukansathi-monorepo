import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const VoiceFAB = ({ onClick }) => {
    return (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClick}
                className={`flex items-center justify-center w-16 h-16 rounded-full shadow-lg border-4 border-slate-50 transition-colors bg-gradient-to-br from-indigo-500 to-purple-600 text-white select-none`}
            >
                <Bot size={32} />
            </motion.button>
        </div>
    );
};

export default VoiceFAB;
