import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const Loader = () => {
    // Get current theme from DOM
    const isDark = useMemo(() => {
        if (typeof document === 'undefined') return true;
        return document.documentElement.getAttribute('data-theme') === 'dark' || 
               (!document.documentElement.getAttribute('data-theme') && 
                window.matchMedia('(prefers-color-scheme: dark)').matches);
    }, []);

    const bgClass = isDark 
        ? 'bg-slate-900/80' 
        : 'bg-slate-50/80';
    
    const borderColor = isDark 
        ? 'border-indigo-900/40' 
        : 'border-indigo-200';
    
    const spinColor = isDark 
        ? 'border-t-indigo-500' 
        : 'border-t-indigo-600';
    
    const dotColor = isDark 
        ? 'bg-indigo-500' 
        : 'bg-indigo-600';
    
    const textColor = isDark 
        ? 'text-slate-400' 
        : 'text-slate-500';

    return (
        <div className={`fixed inset-0 flex items-center justify-center ${bgClass} backdrop-blur-sm z-50`}>
            <div className="relative flex items-center justify-center">
                {/* Outer Ring - Pulsing Effect */}
                <motion.div
                    className={`w-16 h-16 border-4 ${borderColor} rounded-full`}
                    animate={{
                        scale: [1, 1.15, 1],
                        opacity: [0.3, 0.7, 0.3],
                    }}
                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    initial={false} // Prevent animation on mount
                />

                {/* Spinning Ring */}
                <motion.div
                    className={`absolute w-16 h-16 border-4 border-transparent ${spinColor} rounded-full`}
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                    initial={false} // Prevent animation on mount
                />

                {/* Inner Dot */}
                <motion.div
                    className={`absolute w-3 h-3 ${dotColor} rounded-full`}
                    animate={{
                        scale: [0.7, 1.3, 0.7],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    initial={false} // Prevent animation on mount
                />
            </div>

            <motion.p
                className={`absolute mt-24 text-sm font-medium ${textColor} tracking-wider`}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                initial={false} // Prevent animation on mount
            >
                LOADING
            </motion.p>
        </div>
    );
};

export default Loader;
