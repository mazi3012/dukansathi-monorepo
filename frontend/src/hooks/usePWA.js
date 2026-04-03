import { useState, useEffect } from 'react';

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

export const usePWA = () => {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOSDevice, setIsIOSDevice] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Prevent the default browser prompt
            e.preventDefault();
            // Store the event so it can be triggered later
            setInstallPrompt(e);
            console.log("PWA Install Prompt captured");
        };

        const handleAppInstalled = () => {
            setInstallPrompt(null);
            setIsInstalled(true);
            console.log("PWA was installed");
        };

        // Detect iOS
        setIsIOSDevice(isIOS());

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const installApp = async () => {
        if (!installPrompt) {
            console.log("Install prompt not available");
            // On iOS, show custom instructions
            if (isIOSDevice) {
                setShowIOSInstructions(true);
            }
            return;
        }

        // Show the prompt (Chromium-based browsers)
        installPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await installPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, throw it away
        setInstallPrompt(null);
    };

    return {
        isInstallable: !!installPrompt || isIOSDevice,
        isInstalled: isInstalled || isIOSPWA(),
        installApp,
        isIOSDevice,
        showIOSInstructions,
        setShowIOSInstructions
    };
};
