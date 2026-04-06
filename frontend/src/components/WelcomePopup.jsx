import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Gift, Sparkles, MessageSquare, Mic, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WelcomePopup({ isOpen, onClose, creditBalance = 100 }) {
    const navigate = useNavigate();
    const [showDetails, setShowDetails] = useState(false);

    const creditFeatures = [
        {
            icon: MessageSquare,
            label: 'AI Chat',
            cost: '1 credit',
            description: 'Get instant business advice from Sathi AI'
        },
        {
            icon: Mic,
            label: 'Voice-to-Bill',
            cost: '1 credit',
            description: 'Create bills by speaking in Hindi or English'
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4"
                    >
                        <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">
                            {/* Background Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 via-yellow-500/10 to-orange-500/20 pointer-events-none" />

                            <div className="relative bg-card-bg border border-card-border backdrop-blur-xl">
                                {/* Close Button */}
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-card-bg/50 hover:bg-card-bg/80 text-text-muted hover:text-text-main transition-all flex items-center justify-center z-10"
                                >
                                    <X size={18} />
                                </button>

                                {/* Header with Gradient */}
                                <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 p-6 text-white">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.2, duration: 0.4, type: 'spring' }}
                                        className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30"
                                    >
                                        <Gift size={32} />
                                    </motion.div>
                                    <h2 className="text-2xl font-heading font-black text-center tracking-tight">
                                        Welcome to Dukan Sathi!
                                    </h2>
                                </div>

                                {/* Content */}
                                <div className="p-6 space-y-6">
                                    {/* Credit Display */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 rounded-2xl p-6 text-center"
                                    >
                                        <p className="text-sm font-bold text-text-muted uppercase tracking-wider mb-2">
                                            FREE WELCOME BONUS
                                        </p>
                                        <div className="flex items-center justify-center gap-3 mb-2">
                                            <motion.div
                                                animate={{ rotate: [0, 10, -10, 0] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            >
                                                <Coins size={32} className="text-amber-400" />
                                            </motion.div>
                                            <div className="text-right">
                                                <p className="text-4xl font-black text-amber-400">
                                                    {creditBalance}
                                                </p>
                                                <p className="text-xs font-bold text-text-muted">CREDITS</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-text-muted mt-3">
                                            ✨ Already added to your account! Ready to use.
                                        </p>
                                    </motion.div>

                                    {/* What You Can Do */}
                                    <div className="space-y-3">
                                        <p className="text-xs font-black uppercase tracking-wider text-text-muted">
                                            What you can do with credits:
                                        </p>
                                        {creditFeatures.map((feature, idx) => {
                                            const IconComponent = feature.icon;
                                            return (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.4 + idx * 0.1 }}
                                                    className="flex items-start gap-3 p-3 rounded-xl bg-card-bg/50 border border-card-border/50 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                        <IconComponent size={16} className="text-indigo-500" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="font-bold text-text-main text-sm">{feature.label}</p>
                                                            <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-500 px-2 py-0.5 rounded-full shrink-0">
                                                                {feature.cost}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-text-muted mt-0.5">{feature.description}</p>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-4">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => {
                                                navigate('/chat');
                                                onClose();
                                            }}
                                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Sparkles size={16} />
                                            Try AI Chat
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => {
                                                navigate('/credits');
                                                onClose();
                                            }}
                                            className="flex-1 border-2 border-amber-500/30 text-text-main hover:border-amber-500/60 hover:bg-amber-500/5 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <Coins size={16} />
                                            Buy More
                                        </motion.button>
                                    </div>

                                    {/* Info Text */}
                                    <p className="text-center text-[10px] text-text-muted/70">
                                        💡 Free credits reset every month based on your plan
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
