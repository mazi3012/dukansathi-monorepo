import React from 'react';
import { motion } from 'framer-motion';

const Loader = () => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm z-50">
            <div className="relative flex items-center justify-center">
                {/* Outer Ring */}
                <motion.div
                    className="w-16 h-16 border-4 border-indigo-200 rounded-full"
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Spinning Ring */}
                <motion.div
                    className="absolute w-16 h-16 border-4 border-transparent border-t-indigo-600 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />

                {/* Inner Dot */}
                <motion.div
                    className="absolute w-3 h-3 bg-indigo-600 rounded-full"
                    animate={{
                        scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            <motion.p
                className="absolute mt-24 text-sm font-medium text-slate-500 tracking-wider"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            >
                LOADING
            </motion.p>
        </div>
    );
};

export default Loader;
