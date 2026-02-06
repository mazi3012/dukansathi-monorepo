import React from 'react';
import { Mic } from 'lucide-react';
import { motion } from 'framer-motion';

const VoiceFAB = ({ isListening, onClick }) => {
    return (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <motion.button
                whileTap={{ scale: 0.9 }}
                animate={isListening ? { scale: [1, 1.1, 1], boxShadow: "0 0 20px #f59e0b" } : {}}
                transition={isListening ? { repeat: Infinity, duration: 1.5 } : {}}
                onClick={onClick}
                className={`flex items-center justify-center w-16 h-16 rounded-full shadow-lg border-4 border-slate-50 transition-colors ${isListening
                        ? 'bg-red-500 text-white'
                        : 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                    }`}
            >
                <Mic size={32} />
            </motion.button>
        </div>
    );
};

export default VoiceFAB;
