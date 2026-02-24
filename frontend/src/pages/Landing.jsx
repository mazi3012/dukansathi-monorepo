import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Smartphone, Shield, Zap, Mic, BarChart3, Users } from 'lucide-react';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const Landing = () => {
    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative selection:bg-indigo-500/30">
            {/* Background Ambient Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/30 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

            {/* Navbar */}
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="fixed w-full z-50 bg-slate-950/50 backdrop-blur-xl border-b border-white/5"
            >
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-white font-bold font-heading text-lg">DS</span>
                        </div>
                        <span className="font-bold text-white font-heading text-xl tracking-tight">Dukan Sathi</span>
                    </div>
                    <Link to="/login" className="relative group px-6 py-2.5 bg-white/5 border border-white/10 text-white text-sm font-bold rounded-full overflow-hidden transition-all hover:bg-white/10 hover:border-white/20">
                        <span className="relative z-10">Sign In</span>
                    </Link>
                </div>
            </motion.nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-20 px-4 max-w-6xl mx-auto">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col items-center text-center max-w-4xl mx-auto z-10 relative"
                >
                    <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-xs font-bold mb-8 backdrop-blur-md">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Dukan Sathi v2.0 is Live
                    </motion.div>

                    <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300 leading-[1.1] mb-6 tracking-tight">
                        The AI Operating System <br className="hidden md:block" /> for Modern Retail.
                    </motion.h1>

                    <motion.p variants={itemVariants} className="text-slate-400 text-lg md:text-xl md:max-w-2xl mb-12 leading-relaxed">
                        Control your entire store with just your voice. Advanced inventory tracking, instant GST billing, and Telegram CRM—all powered by secure, offline Small Language Models (SLMs).
                    </motion.p>

                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <Link to="/login" className="group relative px-8 py-4 bg-white text-slate-950 text-base font-bold rounded-2xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] transition-all flex items-center justify-center">
                            Get Started Free
                            <ArrowRight className="inline ml-2 group-hover:translate-x-1 transition-transform" size={18} />
                        </Link>
                        <Link to="/setup" className="px-8 py-4 bg-white/5 border border-white/10 text-white text-base font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center backdrop-blur-sm">
                            Run Diagnostics
                        </Link>
                    </motion.div>
                </motion.div>

                {/* Floating Mockup Elements */}
                <div className="mt-24 relative max-w-5xl mx-auto h-[400px] sm:h-[500px] w-full perspective-1000">
                    <motion.div
                        initial={{ opacity: 0, y: 100, rotateX: 20 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{ delay: 0.6, duration: 1, type: "spring" }}
                        className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent border border-white/10 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col"
                    >
                        {/* Fake Browser Top */}
                        <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 bg-slate-950/50">
                            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500/50"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                        </div>
                        {/* Fake Dashboard Content inner */}
                        <div className="flex-1 p-8 flex flex-col gap-6 relative">
                            <div className="w-1/3 h-8 bg-white/5 rounded-lg"></div>
                            <div className="flex gap-4">
                                <div className="w-1/4 h-32 bg-white/5 rounded-xl border border-white/5 animate-pulse-slow"></div>
                                <div className="w-1/4 h-32 bg-white/5 rounded-xl border border-white/5 animate-pulse-slow" style={{ animationDelay: '0.5s' }}></div>
                                <div className="w-1/4 h-32 bg-white/5 rounded-xl border border-white/5 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
                            </div>

                            {/* Floating Voice Bubble */}
                            <motion.div
                                className="absolute bottom-10 right-10 flex items-center gap-3 bg-indigo-600 p-4 rounded-2xl shadow-xl shadow-indigo-500/20 backdrop-blur-xl border border-indigo-400/30"
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <Mic size={20} className="text-white" />
                                </div>
                                <div>
                                    <div className="text-xs text-indigo-200 font-bold mb-0.5">Voice Command Detected</div>
                                    <div className="text-sm text-white font-medium">"Create bill for Rahul, 2 Lux Soap"</div>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Bento Grid Features */}
            <section className="relative py-24 px-6 max-w-6xl mx-auto z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-4">Deeply Integrated.</h2>
                    <p className="text-slate-400 text-lg">Everything you need, packed into a beautiful experience.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Big Feature */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-white/5 to-white-[0.02] border border-white/10 p-8 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] group-hover:bg-indigo-500/20 transition-all duration-500"></div>
                        <div className="w-14 h-14 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 mb-6">
                            <Zap size={28} />
                        </div>
                        <h3 className="text-3xl font-heading font-bold text-white mb-4">Lightning Fast Voice Engine</h3>
                        <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                            Our locally-running Small Language Models process your voice instantly without sending audio to the cloud. Total privacy, zero latency.
                        </p>
                    </motion.div>

                    {/* Small Feature */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-white/5 to-white-[0.02] border border-white/10 p-8 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-6">
                            <Smartphone size={24} />
                        </div>
                        <h3 className="text-xl font-heading font-bold text-white mb-2">Telegram CRM</h3>
                        <p className="text-slate-400">Automated invoices, payment reminders, and receipts sent straight to your customer's Telegram.</p>
                    </motion.div>

                    {/* Small Feature */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-white/5 to-white-[0.02] border border-white/10 p-8 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-6">
                            <BarChart3 size={24} />
                        </div>
                        <h3 className="text-xl font-heading font-bold text-white mb-2">Smart Inventory</h3>
                        <p className="text-slate-400">AI predicts low stock and automatically generates purchase orders.</p>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 text-center text-slate-500 text-sm">
                <p>© 2026 Dukan Sathi. Built for Bharat.</p>
            </footer>
        </div>
    );
};

export default Landing;
