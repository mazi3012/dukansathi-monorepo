import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import NavigationDrawer from '../components/NavigationDrawer';
import { Toaster } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const MainLayout = () => {
    const navigate = useNavigate();
    const [isListening, setIsListening] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUser();

        // Listen for auth changes (like sign out)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const isGuest = localStorage.getItem('guest_mode') === 'true';

            if (!session && !isGuest) {
                navigate('/landing');
            } else if (session) {
                setUser(session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUser = async () => {
        try {
            const isGuest = localStorage.getItem('guest_mode') === 'true';

            if (isGuest) {
                // Set dummy guest user
                setUser({
                    id: 'guest_user_123',
                    email: 'guest@demo.com',
                    user_metadata: {
                        full_name: 'Guest User'
                    }
                });
                setLoading(false);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/landing');
            } else {
                setUser(user);
                // Check onboarding status
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('onboarding_completed')
                    .eq('id', user.id)
                    .single();

                if (!profile || !profile.onboarding_completed) {
                    navigate('/onboarding');
                }
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            navigate('/landing');
        } finally {
            setLoading(false);
        }
    };

    const toggleListening = () => {
        setIsListening(!isListening);
        // TODO: Integrate actual voice logic here
        console.log("Mic toggled", !isListening);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">

            {/* Desktop Sidebar (Hidden on Mobile) */}
            <Sidebar />

            {/* Navigation Drawer Overlay (Mobile Only) */}
            <NavigationDrawer
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                user={user}
            />

            {/* Main Content Area */}
            {/* Added md:pl-64 to push content when sidebar is visible */}
            <main className="flex-1 pb-24 md:pb-0 md:pl-64 pt-4 px-4 overflow-y-auto h-screen">
                <div className="max-w-7xl mx-auto">
                    <Outlet context={{ user }} />
                </div>
            </main>

            {/* Global Toast Notifications */}
            <Toaster position="top-center" />

            {/* Sticky Bottom Nav (Hidden on Desktop) */}
            <div className="md:hidden">
                <BottomNav
                    isListening={isListening}
                    onMicClick={toggleListening}
                    onMenuClick={() => setIsMenuOpen(true)}
                />
            </div>

        </div>
    );
};

export default MainLayout;
