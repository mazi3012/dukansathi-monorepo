import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Smartphone, Shield, Zap, Mic, BarChart3, Users, Wifi, WifiOff, Database, Cpu, LayoutDashboard, TrendingDown, Download } from 'lucide-react';
import logo from '../assets/logo.svg';
import { usePWA } from '../hooks/usePWA';

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
    const { isInstallable, isInstalled, installApp } = usePWA();
    const isElectron = !!window.electronAPI;

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
                        <img src={logo} alt="DukanSathi Logo" className="w-10 h-10 object-contain drop-shadow-md relative z-10" />
                        <span className="font-bold text-white font-heading text-xl tracking-tight">Dukan Sathi</span>
                        <div className="ml-2 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] font-bold text-indigo-400 tracking-wider">SMART SHOP</div>
                    </div>
                    <Link to="/login" className="relative group px-6 py-2.5 bg-white/5 border border-white/10 text-white text-sm font-bold rounded-full overflow-hidden transition-all hover:bg-white/10 hover:border-white/20">
                        <span className="relative z-10">Get Started</span>
                    </Link>
                </div>
            </motion.nav>

            {/* PWA Notification Bar */}
            {isInstallable && !isInstalled && (
                <motion.div 
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 80, opacity: 1 }}
                    className="fixed top-0 left-0 w-full z-40 bg-indigo-600 px-4 py-2 flex items-center justify-center gap-4 text-xs sm:text-sm font-bold shadow-lg"
                >
                    <span>🚀 Experience Dukan Sathi as an App!</span>
                    <button 
                        onClick={() => installApp()}
                        className="bg-white text-indigo-600 px-3 py-1 rounded-full hover:bg-indigo-50 transition-colors"
                    >
                        Install Now
                    </button>
                </motion.div>
            )}

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
                        Your Smart Shop Assistant
                    </motion.div>

                    <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300 leading-[1.1] mb-6 tracking-tight">
                        Speak Your Orders. <br className="hidden md:block" /> Bills Created Instantly.
                    </motion.h1>

                    <motion.p variants={itemVariants} className="text-slate-400 text-lg md:text-xl md:max-w-2xl mb-12 leading-relaxed">
                        The voice-first billing platform built for Indian shop owners. Dictate orders in your language, and watch invoices generate instantly. Manage customers, inventory, and payments — all with your voice.
                    </motion.p>

                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <Link to="/login" className="group relative px-8 py-4 bg-white text-slate-950 text-base font-bold rounded-2xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] transition-all flex items-center justify-center">
                            Get Started Today
                            <ArrowRight className="inline ml-2 group-hover:translate-x-1 transition-transform" size={18} />
                        </Link>

                        {isInstallable && !isInstalled && (
                            <button
                                onClick={async () => {
                                    try {
                                        await installApp();
                                        if ('serviceWorker' in navigator) {
                                            const registration = await navigator.serviceWorker.getRegistration();
                                            if (registration) await registration.update();
                                        }
                                        window.location.reload();
                                    } catch (err) {
                                        console.error("Install failed:", err);
                                    }
                                }}
                                className="group relative px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-base font-bold rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center justify-center shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_-10px_rgba(99,102,241,0.7)] animate-pulse-slow active:scale-95 border-2 border-white/20 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                                <Download className="inline mr-2 relative z-10 group-hover:-translate-y-1 transition-transform" size={18} />
                                <span className="relative z-10">Download App</span>
                            </button>
                        )}
                    </motion.div>
                </motion.div>

                {/* Floating Mockup Elements */}
                <div className="mt-24 relative max-w-4xl mx-auto w-full perspective-1000">
                    <motion.div
                        initial={{ opacity: 0, y: 100, rotateX: 20 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{ delay: 0.6, duration: 1, type: "spring" }}
                        className="relative bg-gradient-to-b from-indigo-500/10 to-transparent border border-white/10 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden p-8 flex flex-col md:flex-row items-center justify-center gap-8"
                    >
                        {/* Voice Input Mock */}
                        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 relative flex flex-col gap-4 w-full md:w-1/2 shadow-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <Mic size={24} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">Your Voice</div>
                                    <div className="text-xs text-green-400 flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                        Listening...
                                    </div>
                                </div>
                            </div>
                            <div className="bg-indigo-600/20 border border-indigo-500/30 p-5 rounded-xl text-lg text-indigo-100 font-medium italic">
                                "Create a bill for 2 Lux soaps and 1kg Aashirvaad atta for Ramesh"
                            </div>
                        </div>

                        <div className="hidden md:flex flex-col items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500/50"></div>
                            <div className="w-2 h-2 rounded-full bg-indigo-500/70"></div>
                            <ArrowRight size={32} className="text-indigo-400" />
                        </div>

                        {/* Invoice Draft Mock */}
                        <div className="w-full md:w-[420px] bg-white rounded-3xl p-8 shadow-[0_0_60px_-10px_rgba(99,102,241,0.6)] text-slate-950 relative transform md:rotate-2 hover:rotate-0 transition-transform duration-500">
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500 rounded-t-3xl"></div>
                            <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-6 mt-2">
                                <div>
                                    <div className="text-2xl font-black text-indigo-600 leading-none mb-2">INVOICE</div>
                                    <div className="text-xs text-slate-500 font-bold tracking-wider uppercase">📋 Bill #INV-240315-001</div>
                                </div>
                                <div className="bg-green-100 text-green-700 font-bold px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wide shadow-sm">Ready to Send</div>
                            </div>
                            <div className="space-y-3 mb-8">
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-slate-700">Lux Soap (×2)</span>
                                    <span className="font-bold text-slate-900">₹90</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-slate-700">Aashirvaad Atta (1kg)</span>
                                    <span className="font-bold text-slate-900">₹65</span>
                                </div>
                                <div className="h-px bg-slate-200 my-3"></div>
                                <div className="flex justify-between items-center text-lg">
                                    <span className="font-black text-slate-600">Total Amount</span>
                                    <span className="font-black text-indigo-600 text-2xl">₹155</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button className="py-3 px-4 rounded-2xl border-2 border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-all hover:shadow-md">✏️ Edit</button>
                                <button className="py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 hover:from-indigo-700 hover:to-blue-700 transition-all hover:shadow-xl">✓ Approve</button>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* PWA App Download CTA */}
                {/* PWA App Download CTA */}
                {isInstallable && !isInstalled && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-20 max-w-3xl mx-auto p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-[32px] backdrop-blur-xl flex flex-col md:flex-row items-center gap-8 text-left"
                    >
                        <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-2xl shadow-indigo-500/30">
                            <Download size={40} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold mb-2">Install Dukan Sathi App</h3>
                            <p className="text-slate-400 text-sm leading-relaxed text-balance">
                                Install the Dukan Sathi app on your phone. Experience 2x faster performance, offline-ready billing, and a smooth native interface while saving storage space.
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                await installApp();
                                if ('serviceWorker' in navigator) {
                                    const registration = await navigator.serviceWorker.getRegistration();
                                    if (registration) await registration.update();
                                }
                                window.location.reload();
                            }}
                            className="group relative px-8 py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-bold rounded-2xl hover:from-indigo-600 hover:to-blue-700 transition-all shadow-xl shadow-indigo-600/30 border-2 border-white/20 overflow-hidden flex items-center gap-2 w-full md:w-auto mt-4 md:mt-0 justify-center"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></div>
                            <Download size={20} className="relative z-10 group-hover:scale-110 transition-transform" />
                            <span className="relative z-10">Install Now</span>
                        </button>
                    </motion.div>
                )}
            </section>

            {/* Features Section */}
            <section className="relative py-24 px-6 max-w-6xl mx-auto z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-4">Everything Your Shop Needs.</h2>
                    <p className="text-slate-400 text-lg">A smart assistant built for your business, in your language.</p>
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
                        <h3 className="text-3xl font-heading font-bold text-white mb-4">Voice-Powered Billing</h3>
                        <p className="text-slate-400 text-lg max-w-md leading-relaxed mb-6">
                            Customer walks in, you speak, and the bill is ready! Simply dictate orders in English, Hindi, or Bangla. Dukan Sathi automatically creates the invoice, updates stock, and manages accounts.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {["Fast Billing", "No Typing", "Multilingual"].map(tag => (
                                <span key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 font-mono font-bold tracking-wider uppercase">{tag}</span>
                            ))}
                        </div>
                    </motion.div>

                    {/* Customer ledger */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-white/5 to-white-[0.02] border border-white/10 p-8 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-6">
                            <Users size={24} />
                        </div>
                        <h3 className="text-xl font-heading font-bold text-white mb-2">Customer & Credit Ledger</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Track customer credit (Udhaar) with a single click. Generate PDF invoices instantly and share them directly via WhatsApp.</p>
                    </motion.div>

                    {/* Smart Inventory */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-white/5 to-white-[0.02] border border-white/10 p-8 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="w-12 h-12 bg-green-500/20 border border-green-500/30 rounded-2xl flex items-center justify-center text-green-400 mb-6">
                            <BarChart3 size={24} />
                        </div>
                        <h3 className="text-xl font-heading font-bold text-white mb-2">Smart Inventory Tracking</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">Manage your products and set low-stock alerts with ease. Get instant updates on your inventory and enjoy seamless offline synchronization.</p>
                    </motion.div>
                </div>
            </section>

            {/* Scrolling Testimonials Section */}
            <section className="relative py-24 z-10 border-t border-white/5 bg-slate-950 overflow-hidden">
                <style>
                    {`
                    @keyframes slide {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(calc(-300px * 5)); }
                    }
                    .animate-slide {
                        width: calc(300px * 10);
                        animation: slide 25s linear infinite;
                    }
                    .animate-slide:hover {
                        animation-play-state: paused;
                    }
                    `}
                </style>
                <div className="text-center mb-16 px-6">
                    <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-4">Trusted by Thousands of Shop Owners</h2>
                    <p className="text-slate-400 text-lg">Modernize your business today like thousands across India!</p>
                </div>

                <div className="relative w-full overflow-hidden flex [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
                    <div className="flex animate-slide items-center">
                        {[
                            { name: "Ramesh Kumar", shop: "Ramesh General Store", text: "Everything is done via voice. No typing required. Saves me so much time!" },
                            { name: "Suresh Gupta", shop: "Gupta Electronics", text: "Tracking credit (Udhaar) has never been this easy. Instant PDF invoices are a lifesaver." },
                            { name: "Priya Sharma", shop: "Priya Boutique", text: "The best app for shop management. It understands my voice perfectly." },
                            { name: "Abdul Rehman", shop: "A-Z General Store", text: "Inventory management takes only minutes now. The app is incredibly fast and simple." },
                            { name: "Amit Patel", shop: "Patel Medicals", text: "The draft bill feature is excellent. Review first, then finalize. Outstanding work." },
                            /* Duplicates for seamless looping */
                            { name: "Ramesh Kumar", shop: "Ramesh General Store", text: "Everything is done via voice. No typing required. Saves me so much time!" },
                            { name: "Suresh Gupta", shop: "Gupta Electronics", text: "Tracking credit (Udhaar) has never been this easy. Instant PDF invoices are a lifesaver." },
                            { name: "Priya Sharma", shop: "Priya Boutique", text: "The best app for shop management. It understands my voice perfectly." },
                            { name: "Abdul Rehman", shop: "A-Z General Store", text: "Inventory management takes only minutes now. The app is incredibly fast and simple." },
                            { name: "Amit Patel", shop: "Patel Medicals", text: "The draft bill feature is excellent. Review first, then finalize. Outstanding work." },
                        ].map((item, idx) => (
                            <div key={idx} className="w-[300px] shrink-0 px-3">
                                <div className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl flex flex-col justify-between h-[200px] hover:bg-white/[0.05] transition-colors">
                                    <div className="mb-4">
                                        <div className="flex gap-1 text-yellow-500 mb-3">
                                            {[1,2,3,4,5].map(star => <svg key={star} className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.401 8.169L12 18.896l-7.335 3.86 1.401-8.169-5.934-5.787 8.2-1.192z"/></svg>)}
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed italic line-clamp-3">"{item.text}"</p>
                                    </div>
                                    <div className="border-t border-white/10 pt-3 mt-auto">
                                        <div className="font-bold text-white text-sm">{item.name}</div>
                                        <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{item.shop}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="relative py-24 px-6 z-10 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-4">
                            Grow Your Business, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Reduce Stress</span>
                        </h2>
                        <p className="text-slate-400 text-lg max-w-xl mx-auto">Zero training required. Works seamlessly on both mobile and desktop.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: <Mic size={24} />, color: "indigo", title: "Multilingual Support", desc: "Manage your shop in English, Hindi, Hinglish, or Bengali with natural voice commands." },
                            { icon: <Shield size={24} />, color: "green", title: "100% Secure Data", desc: "Your accounts and customer data are encrypted and securely stored for your eyes only." },
                            { icon: <Zap size={24} />, color: "orange", title: "Fast & Effortless", desc: "No technical knowledge required. Start managing your business today with zero training." },
                        ].map(({ icon, color, title, desc }) => (
                            <motion.div
                                key={title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl flex flex-col items-center text-center hover:bg-white/[0.05] transition-colors group"
                            >
                                <div className={`w-14 h-14 bg-${color}-500/10 border border-${color}-500/20 rounded-2xl flex items-center justify-center text-${color}-400 mb-6 group-hover:scale-110 transition-transform`}>
                                    {icon}
                                </div>
                                <h4 className="text-lg font-bold text-white mb-3">{title}</h4>
                                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 py-12 text-center text-slate-500 text-sm">
                <p className="mb-2 font-bold text-slate-400 text-xs tracking-wider uppercase">Made with ❤️ for Bharat 🇮🇳</p>
                <p>© 2026 Dukan Sathi. The preferred choice of every shop owner.</p>
            </footer>
        </div >
    );
};

export default Landing;
