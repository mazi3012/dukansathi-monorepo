import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, Smartphone, Shield, Zap } from 'lucide-react';

const Landing = () => {
    return (
        <div className="min-h-screen bg-white">
            {/* Navbar */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold font-heading">DS</span>
                        </div>
                        <span className="font-bold text-slate-900 font-heading text-lg">Dukan Sathi</span>
                    </div>
                    <Link to="/login" className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-full hover:bg-slate-800 transition-colors">
                        Login
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4 max-w-md mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-6">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    AI-Powered Billing App
                </div>
                <h1 className="text-4xl font-heading font-extrabold text-slate-900 leading-tight mb-6">
                    Manage your <span className="text-indigo-600">Dukan</span> like a Pro.
                </h1>
                <p className="text-slate-500 text-lg mb-8 leading-relaxed">
                    Create GST bills, manage inventory, and track udhar - all with the power of AI voice commands.
                </p>
                <Link to="/login" className="block w-full py-4 bg-indigo-600 text-white text-lg font-bold rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all transform hover:-translate-y-1">
                    Get Started Free <ArrowRight className="inline ml-2" size={20} />
                </Link>
                <div className="mt-8 flex items-center justify-center gap-6 text-slate-400">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <Shield size={16} /> Secure
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <Zap size={16} /> Fast
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <Smartphone size={16} /> Mobile First
                    </div>
                </div>
            </section>

            {/* Features Preview */}
            <section className="bg-slate-50 py-20 px-4">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                            <Smartphone size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">WhatsApp Integration</h3>
                        <p className="text-slate-500">Send invoices and payment reminders directly to your customers on WhatsApp.</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-4">
                            <Zap size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Voice Commands</h3>
                        <p className="text-slate-500">Just say "Add 5 Lux Soap" or "Create bill for Rahul" - our AI does the rest.</p>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-4">
                            <CheckCircle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">GST Compliant</h3>
                        <p className="text-slate-500">Generate perfect GST invoices with automatic HSN and tax calculations.</p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Landing;
