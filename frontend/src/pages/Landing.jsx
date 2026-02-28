import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Smartphone, Shield, Zap, Mic, BarChart3, Users, Wifi, WifiOff, Database, Cpu, LayoutDashboard, TrendingDown } from 'lucide-react';

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
                        <div className="ml-2 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold text-indigo-400 tracking-wider">RYZEN AI ENHANCED</div>
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
                        OpenClaw Architecture Powered
                    </motion.div>

                    <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300 leading-[1.1] mb-6 tracking-tight">
                        The Retail OS with <br className="hidden md:block" /> OpenClaw Intelligence.
                    </motion.h1>

                    <motion.p variants={itemVariants} className="text-slate-400 text-lg md:text-xl md:max-w-2xl mb-12 leading-relaxed">
                        Voice-first inventory management for Indian shopkeepers. Powered by <span className="text-white font-semibold">Phi-3 Mini on AMD Ryzen™ AI</span> when offline, and <span className="text-indigo-400 font-semibold">Groq + Llama 4 Scout</span> when connected. No internet? No problem.
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
                        {/* Mock Dashboard Content */}
                        <div className="flex-1 p-8 flex flex-col gap-6 relative">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-1/3 h-8 bg-white/5 rounded-lg"></div>
                                <div className="flex gap-2">
                                    <div className="w-6 h-6 rounded-full bg-white/5"></div>
                                    <div className="w-6 h-6 rounded-full bg-white/5"></div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="w-1/4 h-24 bg-white/5 rounded-xl border border-white/5"></div>
                                <div className="w-1/4 h-24 bg-white/5 rounded-xl border border-white/5"></div>
                                <div className="w-1/4 h-24 bg-white/5 rounded-xl border border-white/5"></div>
                            </div>

                            {/* Dynamic Chat & Invoice Preview */}
                            <div className="mt-4 flex gap-6 h-full">
                                {/* Chat Interface */}
                                <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Live Voice Order</div>

                                    {/* User Bubble */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 1, duration: 0.5 }}
                                        className="self-end bg-indigo-600 px-4 py-2 rounded-2xl rounded-tr-none text-sm text-white shadow-lg"
                                    >
                                        "Rahul ka 2 Lux Soap ka bill bana do"
                                    </motion.div>

                                    {/* AI Processing */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0, 1, 0] }}
                                        transition={{ delay: 2, duration: 2, repeat: Infinity }}
                                        className="flex gap-1 mt-2"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </motion.div>

                                    {/* AI Response */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 3, duration: 0.5 }}
                                        className="self-start bg-white/5 border border-white/10 px-4 py-2 rounded-2xl rounded-tl-none text-sm text-slate-300 shadow-sm"
                                    >
                                        Generating invoice for Rahul...
                                    </motion.div>
                                </div>

                                {/* Generated Invoice Template */}
                                <motion.div
                                    initial={{ opacity: 0, y: 40, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ delay: 4, duration: 0.8, type: "spring" }}
                                    className="w-56 bg-white rounded-xl p-4 shadow-2xl text-slate-950 flex flex-col gap-3 relative"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600 rounded-t-xl"></div>
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <div className="text-[10px] font-bold text-indigo-600">INVOICE #8241</div>
                                        <div className="text-[8px] text-slate-400">26 Feb, 2026</div>
                                    </div>
                                    <div className="space-y-2 py-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="font-medium">Lux Soap (x2)</span>
                                            <span className="font-bold">₹90.00</span>
                                        </div>
                                        <div className="h-px bg-slate-50"></div>
                                        <div className="flex justify-between text-[11px] font-bold mt-2">
                                            <span>Total</span>
                                            <span className="text-indigo-600">₹90.00</span>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Section */}
            <section className="relative py-24 px-6 max-w-6xl mx-auto z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-4">Intelligent Local-First Features.</h2>
                    <p className="text-slate-400 text-lg">Every tool a shopkeeper needs — built for India, optimized for the edge.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Big Feature - Voice to SQL */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="md:col-span-2 md:row-span-2 bg-gradient-to-br from-white/5 to-white-[0.02] border border-white/10 p-8 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] group-hover:bg-indigo-500/20 transition-all duration-500"></div>
                        <div className="w-14 h-14 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 mb-6">
                            <Mic size={28} />
                        </div>
                        <h3 className="text-3xl font-heading font-bold text-white mb-4">Voice-to-SQL Billing Engine</h3>
                        <p className="text-slate-400 text-lg max-w-md leading-relaxed mb-6">
                            Just speak in Hindi or Hinglish — Dukan Sathi uses <span className="text-white font-medium">Whisper STT</span> to transcribe your voice, then an <span className="text-white font-medium">AMD NPU-accelerated Phi-3 Mini</span> to convert it into live database queries. Bills are created, inventory is deducted, and dues are tracked — with zero typing.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {["Whisper STT", "Phi-3 Mini (Ollama)", "SQLite / Supabase", "LangGraph Agent"].map(tag => (
                                <span key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 font-mono">{tag}</span>
                            ))}
                        </div>
                    </motion.div>

                    {/* Telegram Workspace */}
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
                        <h3 className="text-xl font-heading font-bold text-white mb-2">Telegram Dashboard-cum-Workspace</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">A powerful command center for your shop. Manage sales, invoices, customers, and queries in real-time. No separate app needed for operations — it's all in your Telegram.</p>
                    </motion.div>

                    {/* Smart Inventory */}
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
                        <h3 className="text-xl font-heading font-bold text-white mb-2">Smart Inventory & Dues</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Real-time stock tracking with AI-predicted reorder alerts. Customer due ledger auto-updates on every voice command — even while offline.</p>
                    </motion.div>
                </div>
            </section>

            {/* OpenClaw Architecture Visualization Section */}
            <section className="relative py-24 px-6 max-w-6xl mx-auto z-10 border-t border-white/5 overflow-hidden">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-widest uppercase mb-4">
                        The Hybrid Edge Engine
                    </div>
                    <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-6">Hybrid OpenClaw™ Architecture</h2>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">Seamless intelligence across devices. Low latency, high privacy, and incredibly efficient.</p>
                </div>

                <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
                    {/* Perspective Lines Background */}
                    <div className="absolute inset-0 pointer-events-none opacity-20">
                        <svg width="100%" height="100%" viewBox="0 0 1000 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M200 200L500 200M500 200L800 200" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="10 10" />
                            <defs>
                                <linearGradient id="lineGradient" x1="200" y1="200" x2="800" y2="200" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#6366f1" />
                                    <stop offset="0.5" stopColor="#3b82f6" />
                                    <stop offset="1" stopColor="#6366f1" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    {/* Mobile View - Telegram Workspace */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative group"
                    >
                        <div className="absolute -inset-4 bg-blue-500/10 rounded-[2.5rem] blur-xl group-hover:bg-blue-500/20 transition-all"></div>
                        <div className="relative bg-slate-900 border border-white/10 rounded-[2rem] p-4 shadow-2xl">
                            <div className="flex items-center justify-between mb-4 px-2 border-b border-white/5 pb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                                        <Smartphone size={16} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-white">Dukan Sathi Bot</div>
                                        <div className="text-[8px] text-blue-400">Dashboard Workspace</div>
                                    </div>
                                </div>
                                <div className="px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-[6px] font-bold text-green-400">ACTIVE</div>
                            </div>
                            {/* Telegram Chat Style Mockup */}
                            <div className="space-y-3 px-1">
                                <div className="flex flex-col gap-1 items-start">
                                    <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl rounded-tl-none text-[9px] text-slate-300">
                                        Managing sales for today...
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                    <div className="bg-blue-600 px-3 py-1.5 rounded-2xl rounded-tr-none text-[9px] text-white">
                                        Show my invoice for Rahul
                                    </div>
                                </div>
                                {/* Invoice Card in Telegram */}
                                <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-3 flex flex-col gap-2 shadow-lg">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-1">
                                        <div className="text-[8px] font-bold text-white">INVOICE_8241.PDF</div>
                                        <CheckCircle size={10} className="text-green-500" />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-[7px] text-slate-400">Amount: ₹90.00</div>
                                        <div className="text-[7px] font-bold text-blue-400">OPEN BILL</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-2 border-t border-white/5 text-center">
                                <p className="text-[9px] text-slate-500">Workspace Dashboard v2.0</p>
                            </div>
                        </div>
                        <div className="mt-8 text-center lg:text-left">
                            <h4 className="text-lg font-bold text-white mb-2">Mobile Management</h4>
                            <p className="text-sm text-slate-400">Your entire business command center inside Telegram.</p>
                        </div>
                    </motion.div>

                    {/* Central Brain - Cost Efficiency */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="relative flex flex-col items-center"
                    >
                        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-600 to-blue-700 flex flex-col items-center justify-center relative shadow-[0_0_50px_-10px_rgba(99,102,241,0.5)] group">
                            <div className="absolute inset-0 bg-white/10 rounded-full animate-ping-slow"></div>
                            <TrendingDown size={40} className="text-white mb-2 group-hover:scale-110 transition-transform" />
                            <div className="text-3xl font-extrabold text-white">75%</div>
                            <div className="text-[10px] font-bold text-indigo-100 tracking-widest uppercase">Cost Comparison</div>
                        </div>
                        <div className="mt-10 text-center">
                            <h4 className="text-xl font-bold text-white mb-2">Hybrid Intelligence</h4>
                            <p className="text-sm text-slate-400 max-w-xs">Up to 75% cheaper than traditional cloud-only AI solutions by utilizing edge inference.</p>
                        </div>
                    </motion.div>

                    {/* Laptop View - Local AI */}
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative group"
                    >
                        <div className="absolute -inset-4 bg-indigo-500/10 rounded-[2rem] blur-xl group-hover:bg-indigo-500/20 transition-all"></div>
                        <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl">
                            <div className="flex items-center gap-3 mb-4 px-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                    <Cpu size={18} />
                                </div>
                                <div className="text-xs font-bold text-white">Local AI (Ryzen™ AI)</div>
                            </div>
                            {/* Mock UI */}
                            <div className="h-32 bg-slate-950 rounded-xl border border-white/5 p-3 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2">
                                    <div className="flex gap-1">
                                        <div className="w-1 h-3 bg-indigo-500/40 rounded-full animate-pulse"></div>
                                        <div className="w-1 h-3 bg-indigo-500/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-1 h-3 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                                <div className="text-[9px] font-mono text-indigo-400 mb-2">PROCESING INFERENCE...</div>
                                <div className="space-y-2">
                                    <div className="h-1.5 w-full bg-white/5 rounded-full"></div>
                                    <div className="h-1.5 w-5/6 bg-white/5 rounded-full"></div>
                                    <div className="h-1.5 w-4/6 bg-white/10 rounded-full"></div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                    <div className="text-[8px] text-slate-500">NPU Offload Active</div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 text-center lg:text-right">
                            <h4 className="text-lg font-bold text-white mb-2">Laptop Edge Node</h4>
                            <p className="text-sm text-slate-400">Offline-first billing powered by local Phi-3 Mini & LLM.</p>
                        </div>
                    </motion.div>
                </div>
            </section>
            {/* Hybrid AI Architecture Section */}
            <section className="relative py-24 px-6 z-10 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-4">
                            Optimized for <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">AMD RYZEN™ AI</span>
                        </h2>
                        <p className="text-slate-400 text-lg max-w-xl mx-auto">Our app detects NPU/GPU hardware to offload AI inference, reducing latency by 2× and saving battery.</p>
                    </div>

                    {/* Online vs Offline Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                        {/* Offline Mode */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-t-3xl" />
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
                                    <WifiOff size={18} className="text-orange-400" />
                                </div>
                                <div>
                                    <div className="font-bold text-white">Offline Mode</div>
                                    <div className="text-xs text-slate-500">100% on-device · No cloud needed</div>
                                </div>
                            </div>
                            <ul className="space-y-3 text-sm">
                                {[
                                    ["Phi-3 Mini 3.8B", "LLM via Ollama, NPU/GPU accelerated"],
                                    ["Whisper Small", "On-device Speech-to-Text (STT)"],
                                    ["SQLite + OPFS", "Persistent local browser storage"],
                                    ["LangGraph Agent", "Stateful AI task orchestration"],
                                    ["AMD DirectML", "GPU inference offload for silent, fast execution"],
                                ].map(([tech, desc]) => (
                                    <li key={tech} className="flex items-start gap-3">
                                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-2" />
                                        <span><span className="text-white font-mono font-semibold">{tech}</span> <span className="text-slate-500">— {desc}</span></span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        {/* Online Mode */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-t-3xl" />
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                                    <Wifi size={18} className="text-indigo-400" />
                                </div>
                                <div>
                                    <div className="font-bold text-white">Online Mode</div>
                                    <div className="text-xs text-slate-500">Cloud-enhanced · Auto-sync</div>
                                </div>
                            </div>
                            <ul className="space-y-3 text-sm">
                                {[
                                    ["Llama 4 Scout", "Cloud LLM via Groq API (ultra-low latency)"],
                                    ["Groq Whisper", "Cloud-accelerated Speech-to-Text"],
                                    ["Supabase (PostgreSQL)", "Realtime cloud database & auth"],
                                    ["Auto-Sync", "SQLite lazily syncs to Supabase on reconnect"],
                                    ["Telegram Bot", "Command center for owner to manage invoices & queries"],
                                ].map(([tech, desc]) => (
                                    <li key={tech} className="flex items-start gap-3">
                                        <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-2" />
                                        <span><span className="text-white font-mono font-semibold">{tech}</span> <span className="text-slate-500">— {desc}</span></span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>

                    {/* AMD Optimization highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: <Cpu size={20} />, color: "orange", title: "NPU-First Inference", desc: "Whisper and Phi-3 Mini run directly on the AMD NPU when detected, freeing the CPU for app logic." },
                            { icon: <Shield size={20} />, color: "indigo", title: "Edge Privacy", desc: "Customer dues, sale history, and product costs stay in your local SQLite store. Your business, your data." },
                            { icon: <Zap size={20} />, color: "blue", title: "Hybrid Switching", desc: "Automatic fallback from Groq + Supabase (online) to Phi-3 + SQLite (offline) with zero app restart." },
                        ].map(({ icon, color, title, desc }) => (
                            <motion.div
                                key={title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl"
                            >
                                <div className={`w-10 h-10 bg-${color}-500/10 border border-${color}-500/20 rounded-xl flex items-center justify-center text-${color}-400 mb-4`}>
                                    {icon}
                                </div>
                                <h4 className="font-bold text-white mb-2">{title}</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 text-center text-slate-500 text-sm">
                <p className="mb-2">Powered by AMD Ryzen™ AI | Built for Bharat</p>
                <p>© 2026 Dukan Sathi. Innovation at the Edge.</p>
            </footer>
        </div >
    );
};

export default Landing;
