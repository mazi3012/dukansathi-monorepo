import { useState, useEffect, useCallback } from 'react';

/**
 * Detect if running on iOS Safari (including PWA mode)
 */
const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

/**
 * Detect if custom iOS PWA (via "Add to Home Screen")
 */
const isIOSPWA = () => {
    return isIOS() && (window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches);
};

/**
 * Check if already in standalone/fullscreen mode
 */
const isRunningAsApp = () => {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.matchMedia('(display-mode: fullscreen)').matches ||
           window.matchMedia('(display-mode: minimal-ui)').matches ||
           window.navigator.standalone === true;
};

export const usePWA = () => {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOSDevice, setIsIOSDevice] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        // Detect iOS
        setIsIOSDevice(isIOS());

        // Check if already installed
        if (isRunningAsApp() || isIOSPWA()) {
            setIsInstalled(true);
        }

        const handleBeforeInstallPrompt = (e) => {
            // Prevent the default browser prompt
            e.preventDefault();
            // Store the event so it can be triggered later
            setInstallPrompt(e);
            setDeferredPrompt(e);
            console.log("✅ PWA Install Prompt captured (beforeinstallprompt)");
        };

        const handleAppInstalled = () => {
            setInstallPrompt(null);
            setDeferredPrompt(null);
            setIsInstalled(true);
            console.log("✅ PWA was installed successfully");
        };

        // Check display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleDisplayModeChange = () => {
            if (mediaQuery.matches) {
                setIsInstalled(true);
            }
        };
        mediaQuery.addEventListener('change', handleDisplayModeChange);

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            mediaQuery.removeEventListener('change', handleDisplayModeChange);
        };
    }, []);

    const installApp = useCallback(async () => {
        if (!installPrompt && !deferredPrompt) {
            console.log("ℹ️ Install prompt not available - likely iOS or already installed");
            // On iOS, show custom instructions
            if (isIOSDevice) {
                setShowIOSInstructions(true);
                return { success: false, isIOS: true };
            }
            return { success: false, isIOS: false };
        }

        try {
            const promptToUse = installPrompt || deferredPrompt;
            
            // Show the prompt (Chromium-based browsers)
            if (promptToUse && promptToUse.prompt) {
                promptToUse.prompt();

                // Wait for the user to respond to the prompt
                const { outcome } = await promptToUse.userChoice;
                console.log(`👤 User response to install prompt: ${outcome}`);

                if (outcome === 'accepted') {
                    setInstallPrompt(null);
                    setDeferredPrompt(null);
                    setIsInstalled(true);
                    return { success: true, outcome };
                } else {
                    return { success: false, outcome };
                }
            }
        } catch (err) {
            console.error("❌ Install error:", err);
            return { success: false, error: err.message };
        }
    }, [installPrompt, deferredPrompt, isIOSDevice]);

    return {
        isInstallable: !!installPrompt || !!deferredPrompt || isIOSDevice,
        isInstalled: isInstalled || isIOSPWA() || isRunningAsApp(),
        isRunningAsApp: isRunningAsApp(),
        installApp,
        isIOSDevice,
        showIOSInstructions,
        setShowIOSInstructions,
        hasDeferredPrompt: !!installPrompt || !!deferredPrompt,
    };
};
