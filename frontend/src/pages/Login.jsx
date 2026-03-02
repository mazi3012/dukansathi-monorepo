import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

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


    return (
        <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden selection:bg-indigo-500/30">

            {/* Left Pane: Branding / Aesthetic */}
            <div className="relative hidden md:flex w-1/2 flex-col justify-between p-12 bg-slate-900 overflow-hidden border-r border-white/5">
                {/* Ambient glowing orbs */}
                <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />

                <Link to="/landing" className="relative z-10 flex items-center gap-3 text-white">
                    <img src="/src/assets/logo.svg" alt="DukanSathi Logo" className="w-10 h-10 object-contain drop-shadow-md relative z-10" />
                    <span className="font-bold text-white font-heading text-xl tracking-tight">Dukan Sathi</span>
                </Link>

                <div className="relative z-10 max-w-md">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl lg:text-5xl font-heading font-bold text-white mb-6 leading-[1.1]"
                    >
                        Accelerate your retail growth.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 text-lg"
                    >
                        Join thousands of modern shop owners using AI to manage inventory, sales, and customers completely offline.
                    </motion.p>

                    {/* Floating Glass Element */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                        className="mt-12 p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl animate-float-delayed"
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
                                <span className="text-xl">👩‍💻</span>
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white">"It's like having a digital manager."</div>
                                <div className="text-xs text-slate-400">Priya, Supermart Owner</div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="relative z-10 text-xs text-slate-500">
                    © 2026 Dukan Sathi. Built for Bharat.
                </div>
            </div>

            {/* Right Pane: Login Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
                {/* Mobile Back Button */}
                <Link to="/landing" className="md:hidden absolute top-6 left-6 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-full max-w-sm space-y-8"
                >
                    <div className="text-center md:text-left space-y-2">
                        <h1 className="text-3xl font-bold text-white font-heading tracking-tight">Welcome Back</h1>
                        <p className="text-slate-400 text-sm">Sign in to your Dukan Sathi workspace.</p>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="group w-full py-4 px-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-white font-medium hover:bg-white/10 transition-all disabled:opacity-50 relative overflow-hidden"
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
                            {loading ? (
                                <Loader2 className="animate-spin text-indigo-400" size={20} />
                            ) : (
                                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            )}
                            <span className="relative z-10">Continue with Google</span>
                        </button>
                    </div>

                    <p className="text-center md:text-left text-xs text-slate-500 pt-8">
                        By continuing, you agree to our <a href="#" className="underline hover:text-slate-300">Terms of Service</a> and <a href="#" className="underline hover:text-slate-300">Privacy Policy</a>.
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
