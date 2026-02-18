import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error("Login Error:", error);
            alert(error.message);
            setLoading(false);
        }
    };

    const handleGuestLogin = () => {
        setLoading(true);
        // Set guest mode flag
        localStorage.setItem('guest_mode', 'true');
        // Simulate a small delay for better UX
        setTimeout(() => {
            navigate('/');
        }, 800);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-8 border border-slate-100">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg transform rotate-3">
                        <span className="text-2xl text-white font-bold font-heading">DS</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 font-heading">Welcome Back!</h1>
                    <p className="text-slate-500 text-sm">Sign in to manage your Dukan Sathi store.</p>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin text-indigo-600" size={20} />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                        )}
                        <span>Continue with Google</span>
                    </button>

                    <button
                        onClick={handleGuestLogin}
                        disabled={loading}
                        className="w-full text-center text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    >
                        Continue as Guest (Demo)
                    </button>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-slate-400">
                    By continuing, you agree to our Terms of Service.
                </p>

            </div>
        </div>
    );
};

export default Login;
