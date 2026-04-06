import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share2, CheckCircle } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import toast from 'react-hot-toast';

/**
 * Comprehensive PWA Install Button Component
 * Handles both Android (via beforeinstallprompt) and iOS (via instructions modal)
 */
export default function PWAInstallButton({ variant = 'button', className = '', forceShow = false }) {
    const { 
        isInstallable, 
        isInstalled, 
        isRunningAsApp,
        installApp, 
        isIOSDevice, 
        showIOSInstructions,
        setShowIOSInstructions 
    } = usePWA();
    const [isInstalling, setIsInstalling] = useState(false);

    // Don't show if already installed
    if (isInstalled || isRunningAsApp) {
        return null;
    }

    // Don't show if not installable
    if (!isInstallable && !forceShow) {
        return null;
    }

    const handleInstall = useCallback(async () => {
        setIsInstalling(true);
        try {
            const result = await installApp();
            
            if (result.success) {
                toast.success('🎉 App installed! Refresh to see changes.', {
                    duration: 4000,
                    icon: '✨',
                });
            } else if (result.isIOS) {
                // iOS shows instructions modal
                toast('📱 Follow the instructions to install on iOS', {
                    duration: 3000,
                });
            } else if (result.outcome === 'dismissed') {
                toast('You dismissed the install prompt', {
                    duration: 2000,
                });
            } else if (result.reason === 'prompt_unavailable') {
                toast('Open browser menu and tap "Install app" or "Add to Home Screen".', {
                    duration: 4500,
                    icon: '📲',
                });
            }
        } catch (err) {
            toast.error('Failed to install app', {
                duration: 3000,
            });
            console.error('Install error:', err);
        } finally {
            setIsInstalling(false);
        }
    }, [installApp]);

    // Button variant
    if (variant === 'button') {
        return (
            <>
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className={`group relative px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${className}`}
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                    <Download className="relative z-10 w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="relative z-10">
                        {isInstalling ? 'Installing...' : isIOSDevice ? 'Add to Home Screen' : 'Install App'}
                    </span>
                </motion.button>

                {/* iOS Instructions Modal */}
                <iOSInstallModal 
                    isOpen={showIOSInstructions}
                    onClose={() => setShowIOSInstructions(false)}
                />
            </>
        );
    }

    // Banner variant
    if (variant === 'banner') {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 md:py-4 shadow-lg"
                >
                    <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <motion.div
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="shrink-0"
                            >
                                <Download className="w-5 h-5 text-white" />
                            </motion.div>
                            <span className="text-sm md:text-base text-white font-bold truncate">
                                🚀 Get Dukan Sathi as a native app - works offline!
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleInstall}
                                disabled={isInstalling}
                                className="px-4 py-2 bg-white text-indigo-600 text-sm font-bold rounded-full hover:bg-indigo-50 transition-colors disabled:opacity-50"
                            >
                                {isInstalling ? 'Installing...' : 'Install'}
                            </motion.button>
                            <button
                                onClick={() => {
                                    // Hide banner by storing preference
                                    localStorage.setItem('pwa_banner_dismissed', 'true');
                                    window.location.reload();
                                }}
                                className="text-white hover:text-indigo-100 transition-colors p-2"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    }

    // Minimal icon variant
    if (variant === 'icon') {
        return (
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleInstall}
                disabled={isInstalling}
                title="Download Dukan Sathi App"
                className={`p-2 md:p-3 rounded-full border border-card-border bg-card-bg/50 hover:bg-card-bg text-text-muted hover:text-indigo-500 transition-colors disabled:opacity-50 ${className}`}
            >
                <Download className="w-5 h-5 md:w-6 h-6" />
            </motion.button>
        );
    }

    return null;
}

/**
 * iOS Install Instructions Modal
 */
function iOSInstallModal({ isOpen, onClose }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="w-full max-w-sm bg-card-bg border border-card-border rounded-3xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
                                <div className="flex items-center gap-3 mb-2">
                                    <motion.div
                                        animate={{ rotate: [0, 10, -10, 0] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        <Download className="w-8 h-8" />
                                    </motion.div>
                                    <h3 className="text-xl font-black">Install Dukan Sathi</h3>
                                </div>
                                <p className="text-sm text-purple-100">Add to your home screen in 3 steps</p>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    {[
                                        {
                                            num: 1,
                                            icon: '⬆️',
                                            title: 'Tap the Share Button',
                                            desc: 'Look for the share icon (⬆️) at the bottom of Safari'
                                        },
                                        {
                                            num: 2,
                                            icon: '📱',
                                            title: 'Tap "Add to Home Screen"',
                                            desc: 'Scroll down and select this option from the menu'
                                        },
                                        {
                                            num: 3,
                                            icon: '✓',
                                            title: 'Confirm & Add',
                                            desc: 'Edit the name if you like, then tap "Add"'
                                        }
                                    ].map((step, idx) => (
                                        <div key={idx} className="flex gap-4">
                                            <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                                <span className="text-lg font-black text-indigo-500">{step.num}</span>
                                            </div>
                                            <div className="flex-1 py-1">
                                                <p className="font-bold text-text-main mb-1">{step.title}</p>
                                                <p className="text-sm text-text-muted">{step.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
                                    <span className="text-lg shrink-0">💡</span>
                                    <div>
                                        <p className="text-sm font-bold text-text-main mb-1">Benefits</p>
                                        <ul className="text-xs text-text-muted space-y-1">
                                            <li>✓ Works offline</li>
                                            <li>✓ Better microphone access for voice commands</li>
                                            <li>✓ Faster loading times</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-card-border/50 flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 border border-card-border text-text-main font-bold rounded-xl hover:bg-card-bg/50 transition-colors"
                                >
                                    Later
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Got It
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
