import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Smartphone, Shield, Zap, Mic, BarChart3, Users, Wifi, WifiOff, Database, Cpu, LayoutDashboard, TrendingDown } from 'lucide-react';
import logo from '../assets/logo.svg';
import PWAInstallButton from '../components/PWAInstallButton';

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
    const isElectron = !!window.electronAPI;

    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative selection:bg-indigo-500/30">
            {/* Background Ambient Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/30 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

            {/* PWA Install Banner */}
            <PWAInstallButton variant="banner" />

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
            {/* Removed - using banner variant instead */}

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

                        {/* PWA Download Button */}
                        <PWAInstallButton variant="button" forceShow className="text-base px-8 py-4 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_-10px_rgba(99,102,241,0.7)]" />
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
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-20 max-w-3xl mx-auto p-8 bg-gradient-to-r from-indigo-600/10 via-purple-600/5 to-indigo-600/10 border border-indigo-500/30 rounded-[32px] backdrop-blur-xl flex flex-col md:flex-row items-center gap-8 text-left"
                >
                    <motion.div 
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-2xl shadow-indigo-500/40"
                    >
                        <Smartphone size={40} />
                    </motion.div>
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold mb-2 text-white">Get the Native App</h3>
                        <p className="text-slate-300 text-sm leading-relaxed text-balance">
                            Install Dukan Sathi for 2x faster performance, offline-ready billing, better voice recognition, and a smooth native interface.
                        </p>
                    </div>
                    <div className="shrink-0">
                        <PWAInstallButton variant="button" forceShow className="px-8 py-4 shadow-xl shadow-indigo-600/40" />
                    </div>
                </motion.div>
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
            <footer className="relative z-10 border-t border-white/5 bg-slate-950 pt-16 pb-12 overflow-hidden">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        {/* Brand Column */}
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <img src={logo} alt="DukanSathi Logo" className="w-8 h-8 object-contain" />
                                <span className="font-bold text-white font-heading text-lg tracking-tight">Dukan Sathi</span>
                            </div>
                            <p className="text-slate-400 text-sm max-w-sm mb-6 leading-relaxed">
                                Empowering Indian shop owners with the world's first voice-first billing and inventory system. Built with love for Bharat.
                            </p>
                            <div className="flex gap-4">
                                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-all">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-all">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                                </a>
                            </div>
                        </div>

                        {/* Link Columns */}
                        <div>
                            <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-6">Product</h4>
                            <ul className="space-y-4">
                                <li><Link to="/login" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm">Voice AI Chat</Link></li>
                                <li><Link to="/login" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm">Sales Ledger</Link></li>
                                <li><Link to="/login" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm">Inventory</Link></li>
                                <li><Link to="/plans" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm">Pricing Plans</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-6">Support & Legal</h4>
                            <ul className="space-y-4">
                                <li><Link to="/contact" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm font-semibold">Contact & Support</Link></li>
                                <li><Link to="/terms" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm font-semibold">Terms of Service</Link></li>
                                <li><Link to="/terms" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm font-semibold">Privacy Policy</Link></li>
                                <li><a href="mailto:support@dukansathi.com" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm">support@dukansathi.com</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex flex-col items-center md:items-start">
                            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Made with ❤️ for Bharat 🇮🇳</p>
                            <p className="text-slate-500 text-xs">© 2026 Dukan Sathi. All rights reserved.</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Systems Online</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div >
    );
};

export default Landing;
